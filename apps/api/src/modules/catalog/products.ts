import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { assertIfMatch } from '../../shared/concurrency.js';
import { notFound, preconditionFailed, unprocessable } from '../../shared/errors.js';
import { slugify } from '../../shared/text.js';
import { recordAudit } from '../audit/service.js';
import type { AuditMeta } from './categories.js';
import * as repo from './repository.js';
import type { ProductCreation, ProductUpdate } from './schemas.js';
import { removeUnusedKeys } from './storage-cleanup.js';
import { toDetail, type ProductDetail } from './views.js';

/** Base slug of a product; never purely numeric, so `GET /products/{id}` can take either. */
export function baseSlug(name: string): string {
  const slug = slugify(name);
  return /^[0-9-]*$/.test(slug) ? `produto-${slug}`.replace(/-$/, '') : slug;
}

/** First free slug: the base, then base-2, base-3... */
export function nextSlug(base: string, taken: string[]): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export async function detailOf(db: Executor, product: repo.ProductWithCategory): Promise<ProductDetail> {
  const [images, storeMin] = await Promise.all([repo.listImages(db, product.id), repo.defaultStockMin(db)]);
  return toDetail(product, images, storeMin);
}

/** The product for the staff (archived ones included) or a 404. */
export async function findForStaff(db: Executor, id: number): Promise<repo.ProductWithCategory> {
  const product = await repo.findProduct(db, id);
  if (!product) throw notFound('Produto não encontrado.');
  return product;
}

function findByIdOrSlug(db: Executor, idOrSlug: string) {
  return /^[0-9]+$/.test(idOrSlug)
    ? repo.findProduct(db, Number(idOrSlug))
    : repo.findProductBySlug(db, idOrSlug);
}

/** Public detail by id or slug; archived products are visible only to the staff. */
export async function getProduct(ctx: AppContext, idOrSlug: string, staff: boolean): Promise<ProductDetail> {
  const product = await findByIdOrSlug(ctx.db, idOrSlug);
  if (!product || (product.archivedAt !== null && !staff)) throw notFound('Produto não encontrado.');
  return detailOf(ctx.db, product);
}

async function categoryNameFor(db: Executor, categoryId: number): Promise<string> {
  const category = await repo.findCategory(db, categoryId);
  if (!category) {
    throw unprocessable('invalid-category', 'Categoria inválida', 'Escolha uma categoria existente.', {
      errors: [{ path: 'categoryId', message: 'Escolha uma categoria existente.' }],
    });
  }
  return category.name;
}

/** UC Cadastrar Produto: unique slug, initial stock recorded as an IN movement, audited. */
export async function createProduct(ctx: AppContext, input: ProductCreation, meta: AuditMeta) {
  return ctx.db.transaction(async (tx) => {
    const categoryName = await categoryNameFor(tx, input.categoryId);
    const now = ctx.clock.now();
    await repo.lockSlugAllocation(tx);
    const base = baseSlug(input.name);
    const slug = nextSlug(base, await repo.slugsLike(tx, base));
    const { initialStock, ...fields } = input;
    const product = await repo.insertProduct(
      tx,
      { ...fields, slug, stockAvailable: initialStock, createdAt: now, updatedAt: now },
      categoryName,
    );
    if (initialStock > 0) {
      await repo.insertMovements(tx, [
        {
          productId: product.id,
          type: 'IN',
          quantity: initialStock,
          reason: 'Estoque inicial',
          authorId: meta.actor.userId,
          createdAt: now,
        },
      ]);
    }
    const detail = await detailOf(tx, { ...product, categoryName });
    await recordAudit(tx, {
      actorId: meta.actor.userId,
      action: 'product.create',
      resourceType: 'product',
      resourceId: product.id,
      after: detail,
      ip: meta.ip,
    });
    return detail;
  });
}

/**
 * UC Editar Produto with optimistic concurrency: the If-Match header must carry the current
 * version (428 without it, 412 when stale). The slug never changes, so shared links keep working.
 */
export async function updateProduct(
  ctx: AppContext,
  id: number,
  ifMatch: string | undefined,
  changes: ProductUpdate,
  meta: AuditMeta,
) {
  return ctx.db.transaction(async (tx) => {
    const current = await findForStaff(tx, id);
    assertIfMatch(ifMatch, current.version);
    const categoryName =
      changes.categoryId === undefined ? current.categoryName : await categoryNameFor(tx, changes.categoryId);
    const before = await detailOf(tx, current);
    if (!(await repo.updateProductAtVersion(tx, current, changes, categoryName, ctx.clock.now()))) {
      throw preconditionFailed();
    }
    const after = await detailOf(tx, (await repo.findProduct(tx, id))!);
    await recordAudit(tx, {
      actorId: meta.actor.userId,
      action: 'product.update',
      resourceType: 'product',
      resourceId: id,
      before,
      after,
      ip: meta.ip,
    });
    return after;
  });
}

/**
 * UC Excluir Produto (decision D9): a product that was ever ordered is archived; otherwise it is
 * deleted with its photos. Stored files are removed after the commit, only when no row uses them.
 */
export async function deleteProduct(ctx: AppContext, id: number, meta: AuditMeta) {
  const outcome = await ctx.db.transaction(async (tx) => {
    const product = await findForStaff(tx, id);
    const images = await repo.listImages(tx, id);
    const before = toDetail(product, images, await repo.defaultStockMin(tx));
    const archive = await repo.productHasOrders(tx, id);
    if (archive) {
      await repo.setArchivedAt(tx, id, product.archivedAt ?? ctx.clock.now(), ctx.clock.now());
    } else {
      await repo.deleteProduct(tx, id);
    }
    await recordAudit(tx, {
      actorId: meta.actor.userId,
      action: archive ? 'product.archive' : 'product.delete',
      resourceType: 'product',
      resourceId: id,
      before,
      ip: meta.ip,
    });
    return { archive, keys: images.map((image) => image.storageKey) };
  });
  if (outcome.archive) return { result: 'archived' as const };
  await removeUnusedKeys(ctx, outcome.keys);
  return { result: 'deleted' as const };
}

export async function unarchiveProduct(ctx: AppContext, id: number, meta: AuditMeta) {
  return ctx.db.transaction(async (tx) => {
    const product = await findForStaff(tx, id);
    if (product.archivedAt !== null) {
      await repo.setArchivedAt(tx, id, null, ctx.clock.now());
      await recordAudit(tx, {
        actorId: meta.actor.userId,
        action: 'product.unarchive',
        resourceType: 'product',
        resourceId: id,
        ip: meta.ip,
      });
    }
    return detailOf(tx, (await repo.findProduct(tx, id))!);
  });
}
