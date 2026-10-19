import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { auditCategoryChange, type AuditMeta } from './audit.js';
import { isCompleteOrder } from './ordering.js';
import {
  categoryInUse,
  categoryNameTaken,
  categoryNotFound,
  invalidCategoryOrder,
  invalidTargetCategory,
} from './problems.js';
import * as repo from './repository.js';

interface CategoryRename {
  readonly id: number;
  readonly name: string;
  readonly now: Date;
}

interface CategoryDeletion {
  readonly id: number;
  /** Where the products of the category go; required when it has any. */
  readonly moveTo: number | undefined;
  readonly now: Date;
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
  if (!category) throw categoryNotFound();
  return category;
}

async function assertNameFree(db: Executor, name: string, exceptId?: number) {
  const taken = await repo.findCategoryByName(db, name);
  if (taken && taken.id !== exceptId) throw categoryNameTaken(taken.name);
}

async function insertAuditedCategory(tx: Executor, name: string, meta: AuditMeta) {
  await assertNameFree(tx, name);
  const category = await repo.insertCategory(tx, name);
  const view = await viewOf(tx, category.id);
  await auditCategoryChange(tx, meta, category.id, { action: 'category.create', after: view });
  return view;
}

export async function createCategory(ctx: AppContext, name: string, meta: AuditMeta) {
  return ctx.db.transaction((tx) => insertAuditedCategory(tx, name, meta));
}

async function renameAuditedCategory(tx: Executor, rename: CategoryRename, meta: AuditMeta) {
  const before = await existing(tx, rename.id);
  await assertNameFree(tx, rename.name, rename.id);
  await repo.renameCategory(tx, rename.id, rename.name, rename.now);
  await repo.refreshCategorySearchText(tx, rename.id);
  await auditCategoryChange(tx, meta, rename.id, {
    action: 'category.update',
    before: { name: before.name },
    after: { name: rename.name },
  });
  return viewOf(tx, rename.id);
}

/** Renaming also refreshes the search text of the products, which includes the category name. */
export async function renameCategory(ctx: AppContext, id: number, name: string, meta: AuditMeta) {
  const rename = { id, name, now: ctx.clock.now() };
  return ctx.db.transaction((tx) => renameAuditedCategory(tx, rename, meta));
}

async function validTargetCategory(tx: Executor, deletion: CategoryDeletion, productCount: number) {
  if (deletion.moveTo === undefined) throw categoryInUse(productCount);
  if (deletion.moveTo === deletion.id || !(await repo.findCategory(tx, deletion.moveTo))) {
    throw invalidTargetCategory();
  }
  return deletion.moveTo;
}

/** Moves the products out of the category being deleted; returns how many were moved. */
async function moveProductsOut(tx: Executor, deletion: CategoryDeletion): Promise<number> {
  const productCount = await repo.countProductsInCategory(tx, deletion.id);
  if (productCount === 0) return 0;
  const target = await validTargetCategory(tx, deletion, productCount);
  const moved = await repo.moveProducts(tx, deletion.id, target, deletion.now);
  await repo.refreshCategorySearchText(tx, target);
  return moved;
}

async function deleteAuditedCategory(tx: Executor, deletion: CategoryDeletion, meta: AuditMeta) {
  const category = await existing(tx, deletion.id);
  const moved = await moveProductsOut(tx, deletion);
  await repo.deleteCategory(tx, deletion.id);
  await auditCategoryChange(tx, meta, deletion.id, {
    action: 'category.delete',
    before: { name: category.name, position: category.position },
    after: moved > 0 ? { movedProducts: moved, movedTo: deletion.moveTo } : null,
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
  const deletion = { id, moveTo, now: ctx.clock.now() };
  await ctx.db.transaction((tx) => deleteAuditedCategory(tx, deletion, meta));
}

async function reorderAuditedCategories(tx: Executor, ids: number[], now: Date, meta: AuditMeta) {
  if (!isCompleteOrder(ids, await repo.categoryIds(tx))) throw invalidCategoryOrder();
  const before = await listCategories(tx);
  await repo.setCategoryPositions(tx, ids, now);
  await auditCategoryChange(tx, meta, null, {
    action: 'category.reorder',
    before: before.map((category) => category.id),
    after: ids,
  });
  return listCategories(tx);
}

/** Replaces the order of every category; the list must contain each category exactly once. */
export async function reorderCategories(ctx: AppContext, ids: number[], meta: AuditMeta) {
  const now = ctx.clock.now();
  return ctx.db.transaction((tx) => reorderAuditedCategories(tx, ids, now, meta));
}
