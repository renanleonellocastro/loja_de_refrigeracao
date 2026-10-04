import { imageView } from '../media/service.js';
import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { conflict } from '../../shared/errors.js';
import { pageOf, toLimitOffset, type PageQuery } from '../../shared/pagination.js';
import { recordAudit } from '../audit/service.js';
import type { AuditMeta } from './categories.js';
import { findForStaff } from './products.js';
import * as repo from './repository.js';
import type { StockMovementInput } from './schemas.js';
import { isLowStock } from './views.js';

export interface StockRequest {
  productId: number;
  quantity: number;
}

export interface UnavailableItem {
  productId: number;
  requested: number;
  available: number;
}

export interface StockLink {
  orderId?: number | null;
  authorId?: number | null;
}

/** The 409 of docs/API.md: which items do not have the requested quantity. */
export const insufficientStock = (
  items: UnavailableItem[],
  detail = 'Alguns itens não têm a quantidade pedida disponível.',
) => conflict('insufficient-stock', 'Estoque insuficiente', detail, { items });

/** Signed change of the available quantity for a manual movement. */
export function deltaOf(input: { type: StockMovementInput['type']; quantity: number }): number {
  if (input.type === 'IN') return input.quantity;
  if (input.type === 'LOSS') return -input.quantity;
  return input.quantity;
}

function movementView(row: repo.StockMovementRow, authorName: string | null) {
  return {
    id: row.id,
    type: row.type,
    quantity: row.quantity,
    reason: row.reason,
    authorId: row.authorId,
    authorName,
    orderId: row.orderId,
    createdAt: row.createdAt,
  };
}

export async function listMovements(ctx: AppContext, productId: number, query: PageQuery) {
  await findForStaff(ctx.db, productId);
  const { rows, total } = await repo.listMovements(ctx.db, productId, toLimitOffset(query));
  return pageOf(
    rows.map((row) => movementView(row, row.authorName)),
    query,
    total,
  );
}

/**
 * UC Movimentar Estoque: IN adds, LOSS subtracts, ADJUSTMENT applies a signed quantity.
 * The update is a single conditional statement, so concurrent movements never take the
 * available quantity below zero (invariant 1 of docs/DOMINIO.md).
 */
export async function recordMovement(
  ctx: AppContext,
  productId: number,
  input: StockMovementInput,
  meta: AuditMeta,
) {
  const product = await findForStaff(ctx.db, productId);
  const delta = deltaOf(input);
  return ctx.db.transaction(async (tx) => {
    const stockAvailable = await repo.applyStockDelta(tx, productId, delta);
    if (stockAvailable === undefined) {
      const current = await findForStaff(tx, productId);
      throw insufficientStock(
        [{ productId, requested: -delta, available: current.stockAvailable }],
        `Há ${current.stockAvailable} unidade(s) disponível(is). A movimentação deixaria o estoque negativo.`,
      );
    }
    const now = ctx.clock.now();
    const [movement] = await repo.insertMovements(tx, [
      {
        productId,
        type: input.type,
        quantity: delta,
        reason: input.reason,
        authorId: meta.actor.userId,
        createdAt: now,
      },
    ]);
    await recordAudit(tx, {
      actorId: meta.actor.userId,
      action: 'product.stock',
      resourceType: 'product',
      resourceId: productId,
      before: { stockAvailable: stockAvailable - delta },
      after: { stockAvailable, type: input.type, quantity: delta, reason: input.reason },
      ip: meta.ip,
    });
    return {
      movement: movementView(movement!, await repo.findAuthorName(tx, meta.actor.userId)),
      stockAvailable,
      lowStock: isLowStock({ stockAvailable, stockMin: product.stockMin }, await repo.defaultStockMin(tx)),
    };
  });
}

/** Sums quantities of repeated products and sorts by id, so concurrent orders lock rows in the same order. */
function consolidate(items: StockRequest[]): StockRequest[] {
  const totals = new Map<number, number>();
  for (const item of items) totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity);
  return [...totals.entries()]
    .sort(([a], [b]) => a - b)
    .map(([productId, quantity]) => ({ productId, quantity }));
}

/**
 * Reserves stock for an order inside the caller's transaction (RESERVATION movements).
 * Archived or missing products count as unavailable. Returns the items that could not be
 * reserved; when the list is not empty the caller must roll the transaction back
 * (for example by throwing `insufficientStock(items)`).
 */
export async function reserveStock(
  tx: Executor,
  items: StockRequest[],
  link: StockLink,
  now: Date,
): Promise<UnavailableItem[]> {
  const unavailable: UnavailableItem[] = [];
  const reserved: repo.NewStockMovement[] = [];
  for (const item of consolidate(items)) {
    const left = await repo.applyStockDelta(tx, item.productId, -item.quantity, true);
    if (left === undefined) {
      const [current] = await repo.findProductsByIds(tx, [item.productId]);
      const available = current && current.archivedAt === null ? current.stockAvailable : 0;
      unavailable.push({ productId: item.productId, requested: item.quantity, available });
    } else {
      reserved.push({
        ...link,
        productId: item.productId,
        type: 'RESERVATION',
        quantity: -item.quantity,
        createdAt: now,
      });
    }
  }
  if (unavailable.length === 0) await repo.insertMovements(tx, reserved);
  return unavailable;
}

/** Gives reserved stock back (order canceled) inside the caller's transaction (RELEASE movements). */
export async function releaseStock(
  tx: Executor,
  items: StockRequest[],
  link: StockLink,
  now: Date,
): Promise<void> {
  const released: repo.NewStockMovement[] = [];
  for (const item of consolidate(items)) {
    await repo.applyStockDelta(tx, item.productId, item.quantity);
    released.push({
      ...link,
      productId: item.productId,
      type: 'RELEASE',
      quantity: item.quantity,
      createdAt: now,
    });
  }
  await repo.insertMovements(tx, released);
}

/** Name, price, availability and cover photo of products, by id (missing ids are left out). */
export async function productsForOrder(db: Executor, ids: number[]) {
  const unique = [...new Set(ids)];
  const [rows, covers] = await Promise.all([repo.findProductsByIds(db, unique), repo.coversOf(db, unique)]);
  return rows.map((row) => {
    const cover = covers.find((image) => image.productId === row.id);
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      priceCents: row.priceCents,
      stockAvailable: row.stockAvailable,
      archived: row.archivedAt !== null,
      cover: cover ? imageView({ key: cover.storageKey, width: cover.width, height: cover.height }) : null,
    };
  });
}
