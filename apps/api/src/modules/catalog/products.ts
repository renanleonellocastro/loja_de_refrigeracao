import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { assertIfMatch } from '../../shared/concurrency.js';
import { preconditionFailed } from '../../shared/errors.js';
import { slugify } from '../../shared/text.js';
import { auditProductChange, type AuditMeta } from './audit.js';
import { invalidCategory, productNotFound } from './problems.js';
import * as repo from './repository.js';
import type { ProductCreation, ProductUpdate } from './schemas.js';
import { removeUnusedKeys } from './storage-cleanup.js';
import { toDetail, type ProductDetail } from './views.js';

const INITIAL_STOCK_REASON = 'Estoque inicial';

type InitialStock = Pick<repo.NewStockMovement, 'productId' | 'quantity' | 'authorId' | 'createdAt'>;

interface ProductEdit {
  readonly id: number;
  readonly ifMatch: string | undefined;
  readonly changes: ProductUpdate;
  readonly now: Date;
}

/** How a product leaves the catalog: archived when it was ever ordered, deleted otherwise (D9). */
interface ProductRemoval {
  readonly action: string;
  apply(tx: Executor, product: repo.ProductWithCategory, now: Date): Promise<void>;
}

const ARCHIVAL: ProductRemoval = {
  action: 'product.archive',
  apply: (tx, product, now) => repo.setArchivedAt(tx, product.id, product.archivedAt ?? now, now),
};

const DELETION: ProductRemoval = {
  action: 'product.delete',
  apply: (tx, product) => repo.deleteProduct(tx, product.id),
};

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
  if (!product) throw productNotFound();
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
  if (!product || (product.archivedAt !== null && !staff)) throw productNotFound();
  return detailOf(ctx.db, product);
}

async function categoryNameFor(db: Executor, categoryId: number): Promise<string> {
  const category = await repo.findCategory(db, categoryId);
  if (!category) throw invalidCategory();
  return category.name;
}

/** Serialized by an advisory lock, so two products created at once never get the same slug. */
async function allocateSlug(tx: Executor, name: string): Promise<string> {
  await repo.lockSlugAllocation(tx);
  const base = baseSlug(name);
  return nextSlug(base, await repo.slugsLike(tx, base));
}

async function insertWithFreeSlug(tx: Executor, input: ProductCreation, categoryName: string, now: Date) {
  const slug = await allocateSlug(tx, input.name);
  const { initialStock, ...fields } = input;
  const product = { ...fields, slug, stockAvailable: initialStock, createdAt: now, updatedAt: now };
  return repo.insertProduct(tx, product, categoryName);
}

async function recordInitialStock(tx: Executor, stock: InitialStock): Promise<void> {
  if (stock.quantity <= 0) return;
  await repo.insertMovements(tx, [{ ...stock, type: 'IN', reason: INITIAL_STOCK_REASON }]);
}

async function insertAuditedProduct(tx: Executor, input: ProductCreation, now: Date, meta: AuditMeta) {
  const categoryName = await categoryNameFor(tx, input.categoryId);
  const product = await insertWithFreeSlug(tx, input, categoryName, now);
  await recordInitialStock(tx, {
    productId: product.id,
    quantity: input.initialStock,
    authorId: meta.actor.userId,
    createdAt: now,
  });
  const detail = await detailOf(tx, { ...product, categoryName });
  await auditProductChange(tx, meta, product.id, { action: 'product.create', after: detail });
  return detail;
}

/** UC Cadastrar Produto: unique slug, initial stock recorded as an IN movement, audited. */
export async function createProduct(ctx: AppContext, input: ProductCreation, meta: AuditMeta) {
  const now = ctx.clock.now();
  return ctx.db.transaction((tx) => insertAuditedProduct(tx, input, now, meta));
}

function categoryNameAfter(tx: Executor, current: repo.ProductWithCategory, changes: ProductUpdate) {
  return changes.categoryId === undefined ? current.categoryName : categoryNameFor(tx, changes.categoryId);
}

/** Saves the changes unless someone else changed the product since it was read (412). */
async function saveAtVersion(tx: Executor, current: repo.ProductWithCategory, edit: ProductEdit) {
  const categoryName = await categoryNameAfter(tx, current, edit.changes);
  const isSaved = await repo.updateProductAtVersion(tx, current, edit.changes, categoryName, edit.now);
  if (!isSaved) throw preconditionFailed();
}

async function updateAuditedProduct(tx: Executor, edit: ProductEdit, meta: AuditMeta) {
  const current = await findForStaff(tx, edit.id);
  assertIfMatch(edit.ifMatch, current.version);
  const before = await detailOf(tx, current);
  await saveAtVersion(tx, current, edit);
  const after = await detailOf(tx, (await repo.findProduct(tx, edit.id))!);
  await auditProductChange(tx, meta, edit.id, { action: 'product.update', before, after });
  return after;
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
  const edit = { id, ifMatch, changes, now: ctx.clock.now() };
  return ctx.db.transaction((tx) => updateAuditedProduct(tx, edit, meta));
}

/** Returns whether the product was archived and the storage keys of its photos. */
async function removeAuditedProduct(tx: Executor, id: number, now: Date, meta: AuditMeta) {
  const product = await findForStaff(tx, id);
  const images = await repo.listImages(tx, id);
  const before = toDetail(product, images, await repo.defaultStockMin(tx));
  const isArchived = await repo.productHasOrders(tx, id);
  const removal = isArchived ? ARCHIVAL : DELETION;
  await removal.apply(tx, product, now);
  await auditProductChange(tx, meta, id, { action: removal.action, before });
  return { isArchived, keys: images.map((image) => image.storageKey) };
}

/**
 * UC Excluir Produto (decision D9): a product that was ever ordered is archived; otherwise it is
 * deleted with its photos. Stored files are removed after the commit, only when no row uses them.
 */
export async function deleteProduct(ctx: AppContext, id: number, meta: AuditMeta) {
  const now = ctx.clock.now();
  const outcome = await ctx.db.transaction((tx) => removeAuditedProduct(tx, id, now, meta));
  if (outcome.isArchived) return { result: 'archived' as const };
  await removeUnusedKeys(ctx, outcome.keys);
  return { result: 'deleted' as const };
}

async function restoreAuditedProduct(tx: Executor, id: number, now: Date, meta: AuditMeta) {
  await repo.setArchivedAt(tx, id, null, now);
  await auditProductChange(tx, meta, id, { action: 'product.unarchive' });
}

async function unarchiveInTransaction(tx: Executor, id: number, now: Date, meta: AuditMeta) {
  const product = await findForStaff(tx, id);
  if (product.archivedAt !== null) await restoreAuditedProduct(tx, id, now, meta);
  return detailOf(tx, (await repo.findProduct(tx, id))!);
}

export async function unarchiveProduct(ctx: AppContext, id: number, meta: AuditMeta) {
  const now = ctx.clock.now();
  return ctx.db.transaction((tx) => unarchiveInTransaction(tx, id, now, meta));
}
