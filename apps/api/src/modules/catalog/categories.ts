import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { conflict, notFound, unprocessable } from '../../shared/errors.js';
import { recordAudit } from '../audit/service.js';
import type { AccessClaims } from '../auth/service.js';
import * as repo from './repository.js';

export interface AuditMeta {
  actor: AccessClaims;
  ip: string;
}

export async function listCategories(db: Executor) {
  const rows = await repo.listCategories(db);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    position: row.position,
    productCount: row.productCount,
  }));
}

async function viewOf(db: Executor, id: number) {
  const rows = await listCategories(db);
  return rows.find((row) => row.id === id)!;
}

async function existing(db: Executor, id: number) {
  const category = await repo.findCategory(db, id);
  if (!category) throw notFound('Categoria não encontrada.');
  return category;
}

async function assertNameFree(db: Executor, name: string, exceptId?: number) {
  const taken = await repo.findCategoryByName(db, name);
  if (taken && taken.id !== exceptId) {
    throw conflict('category-name-taken', 'Categoria já existe', `Já existe a categoria "${taken.name}".`, {
      errors: [{ path: 'name', message: 'Já existe uma categoria com este nome.' }],
    });
  }
}

export async function createCategory(ctx: AppContext, name: string, meta: AuditMeta) {
  return ctx.db.transaction(async (tx) => {
    await assertNameFree(tx, name);
    const category = await repo.insertCategory(tx, name);
    const view = await viewOf(tx, category.id);
    await recordAudit(tx, {
      actorId: meta.actor.userId,
      action: 'category.create',
      resourceType: 'category',
      resourceId: category.id,
      after: view,
      ip: meta.ip,
    });
    return view;
  });
}

/** Renaming also refreshes the search text of the products, which includes the category name. */
export async function renameCategory(ctx: AppContext, id: number, name: string, meta: AuditMeta) {
  return ctx.db.transaction(async (tx) => {
    const before = await existing(tx, id);
    await assertNameFree(tx, name, id);
    await repo.renameCategory(tx, id, name, ctx.clock.now());
    await repo.refreshCategorySearchText(tx, id);
    const view = await viewOf(tx, id);
    await recordAudit(tx, {
      actorId: meta.actor.userId,
      action: 'category.update',
      resourceType: 'category',
      resourceId: id,
      before: { name: before.name },
      after: { name },
      ip: meta.ip,
    });
    return view;
  });
}

/**
 * A category with products is only deleted after moving them (UC Gerenciar Categorias):
 * without `moveTo` the answer is 409 with the number of products.
 */
export async function deleteCategory(
  ctx: AppContext,
  id: number,
  moveTo: number | undefined,
  meta: AuditMeta,
) {
  await ctx.db.transaction(async (tx) => {
    const category = await existing(tx, id);
    const productCount = await repo.countProductsInCategory(tx, id);
    let moved = 0;
    if (productCount > 0) {
      if (moveTo === undefined) {
        throw conflict(
          'category-in-use',
          'Categoria com produtos',
          `A categoria tem ${productCount} produto(s). Mova os produtos para outra categoria antes de excluir.`,
          { productCount },
        );
      }
      if (moveTo === id || !(await repo.findCategory(tx, moveTo))) {
        throw unprocessable(
          'invalid-target-category',
          'Categoria de destino inválida',
          'Escolha outra categoria.',
          {
            errors: [{ path: 'moveTo', message: 'Escolha outra categoria existente.' }],
          },
        );
      }
      moved = await repo.moveProducts(tx, id, moveTo, ctx.clock.now());
      await repo.refreshCategorySearchText(tx, moveTo);
    }
    await repo.deleteCategory(tx, id);
    await recordAudit(tx, {
      actorId: meta.actor.userId,
      action: 'category.delete',
      resourceType: 'category',
      resourceId: id,
      before: { name: category.name, position: category.position },
      after: moved > 0 ? { movedProducts: moved, movedTo: moveTo } : null,
      ip: meta.ip,
    });
  });
}

/** Replaces the order of every category; the list must contain each category exactly once. */
export async function reorderCategories(ctx: AppContext, ids: number[], meta: AuditMeta) {
  return ctx.db.transaction(async (tx) => {
    const current = await repo.categoryIds(tx);
    const unique = new Set(ids);
    if (
      unique.size !== ids.length ||
      ids.length !== current.length ||
      current.some((id) => !unique.has(id))
    ) {
      throw unprocessable(
        'invalid-category-order',
        'Ordem inválida',
        'Envie todas as categorias, cada uma uma única vez.',
        { errors: [{ path: 'ids', message: 'Envie todas as categorias, cada uma uma única vez.' }] },
      );
    }
    const before = await listCategories(tx);
    await repo.setCategoryPositions(tx, ids, ctx.clock.now());
    await recordAudit(tx, {
      actorId: meta.actor.userId,
      action: 'category.reorder',
      resourceType: 'category',
      before: before.map((c) => c.id),
      after: ids,
      ip: meta.ip,
    });
    return listCategories(tx);
  });
}
