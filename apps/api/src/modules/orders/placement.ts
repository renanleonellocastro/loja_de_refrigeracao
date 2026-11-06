import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import * as catalog from '../catalog/service.js';
import * as repo from './repository.js';
import type { OrderStatus } from './status.js';

export type OrderChannel = repo.OrderRow['channel'];

export interface ItemRequest {
  productId: number;
  quantity: number;
}

export interface Placement {
  customerId: number;
  createdById: number;
  items: ItemRequest[];
  channel: OrderChannel;
  notes?: string | undefined;
}

export interface OrderLine {
  productId: number;
  quantity: number;
  productName: string;
  unitPriceCents: number;
}

export interface PlacedOrder {
  order: repo.OrderRow;
  snapshot: OrderLine[];
  totalCents: number;
}

type OrderProduct = Awaited<ReturnType<typeof catalog.productsForOrder>>[number];

/** Counter sales leave the store with the customer; online orders wait for the store to pick them. */
const INITIAL_STATUS: Readonly<Record<OrderChannel, OrderStatus>> = {
  ONLINE: 'PENDING_REVIEW',
  COUNTER: 'PICKED_UP',
};

function isSellable(products: OrderProduct[], productId: number): boolean {
  return products.some((product) => product.id === productId && !product.archived);
}

function assertProductsSellable(items: ItemRequest[], products: OrderProduct[]): void {
  const missing = items.filter((item) => !isSellable(products, item.productId));
  if (missing.length === 0) return;
  throw catalog.insufficientStock(
    missing.map((item) => ({ productId: item.productId, requested: item.quantity, available: 0 })),
  );
}

function quantitiesByProduct(items: ItemRequest[]): Map<number, number> {
  const quantities = new Map<number, number>();
  for (const item of items)
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  return quantities;
}

/** One line per product with the price frozen at the moment of the order. */
function snapshotLines(items: ItemRequest[], products: OrderProduct[]): OrderLine[] {
  return [...quantitiesByProduct(items)].map(([productId, quantity]) => {
    const product = products.find((candidate) => candidate.id === productId)!;
    return { productId, quantity, productName: product.name, unitPriceCents: product.priceCents };
  });
}

function totalOf(lines: OrderLine[]): number {
  return lines.reduce((total, line) => total + line.unitPriceCents * line.quantity, 0);
}

function insertOrder(tx: Executor, input: Placement, totalCents: number, now: Date) {
  return repo.insertOrder(tx, {
    customerId: input.customerId,
    channel: input.channel,
    status: INITIAL_STATUS[input.channel],
    totalCents,
    createdById: input.createdById,
    notes: input.notes || null,
    createdAt: now,
    updatedAt: now,
  });
}

async function reserveOrFail(
  ctx: AppContext,
  tx: Executor,
  lines: OrderLine[],
  link: catalog.StockLink,
  now: Date,
) {
  const unavailable = await catalog.reserveStock(ctx, tx, lines, link, now);
  if (unavailable.length > 0) throw catalog.insufficientStock(unavailable);
}

async function recordLines(tx: Executor, order: repo.OrderRow, lines: OrderLine[], now: Date) {
  await repo.insertOrderItems(
    tx,
    lines.map((line) => ({ orderId: order.id, ...line })),
  );
  await repo.insertOrderEvent(tx, {
    orderId: order.id,
    fromStatus: null,
    toStatus: order.status,
    actorId: order.createdById,
    createdAt: now,
  });
}

/**
 * Creates an order with frozen prices and an atomic stock reservation (decision D2).
 * Any item without stock rolls everything back with a 409 listing the items.
 */
export async function placeOrder(ctx: AppContext, tx: Executor, input: Placement): Promise<PlacedOrder> {
  const now = ctx.clock.now();
  const products = await catalog.productsForOrder(
    tx,
    input.items.map((item) => item.productId),
  );
  assertProductsSellable(input.items, products);
  const snapshot = snapshotLines(input.items, products);
  const totalCents = totalOf(snapshot);
  const order = await insertOrder(tx, input, totalCents, now);
  await reserveOrFail(ctx, tx, snapshot, { orderId: order.id, authorId: input.createdById }, now);
  await recordLines(tx, order, snapshot, now);
  return { order, snapshot, totalCents };
}
