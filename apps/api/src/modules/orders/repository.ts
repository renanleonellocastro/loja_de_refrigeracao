import { and, asc, count, desc, eq, gte, ilike, inArray, lte, sql, sum, type SQL } from 'drizzle-orm';
import type { Executor } from '../../infra/db/client.js';
import { cartItems, orderEvents, orderItems, orders, users } from '../../infra/db/schema.js';
import { normalizeText } from '../../shared/text.js';
import type { OrderStatus } from './status.js';

export type OrderRow = typeof orders.$inferSelect;

// Cart

export async function cartOf(db: Executor, userId: number) {
  return db
    .select({ productId: cartItems.productId, quantity: cartItems.quantity })
    .from(cartItems)
    .where(eq(cartItems.userId, userId))
    .orderBy(asc(cartItems.updatedAt), asc(cartItems.productId));
}

export async function setCartItem(
  db: Executor,
  userId: number,
  productId: number,
  quantity: number,
  now: Date,
) {
  await db
    .insert(cartItems)
    .values({ userId, productId, quantity, updatedAt: now })
    .onConflictDoUpdate({
      target: [cartItems.userId, cartItems.productId],
      set: { quantity, updatedAt: now },
    });
}

export async function removeCartItem(db: Executor, userId: number, productId: number): Promise<void> {
  await db.delete(cartItems).where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)));
}

export async function clearCart(db: Executor, userId: number): Promise<void> {
  await db.delete(cartItems).where(eq(cartItems.userId, userId));
}

// Orders

export async function insertOrder(db: Executor, values: typeof orders.$inferInsert): Promise<OrderRow> {
  const [row] = await db.insert(orders).values(values).returning();
  return row!;
}

export async function insertOrderItems(
  db: Executor,
  values: Array<typeof orderItems.$inferInsert>,
): Promise<void> {
  await db.insert(orderItems).values(values);
}

export async function insertOrderEvent(db: Executor, values: typeof orderEvents.$inferInsert): Promise<void> {
  await db.insert(orderEvents).values(values);
}

export async function findOrder(db: Executor, id: number): Promise<OrderRow | undefined> {
  const [row] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return row;
}

export async function updateOrderStatus(
  db: Executor,
  id: number,
  status: OrderStatus,
  now: Date,
): Promise<OrderRow> {
  const [row] = await db.update(orders).set({ status, updatedAt: now }).where(eq(orders.id, id)).returning();
  return row!;
}

export async function itemsOf(db: Executor, orderId: number) {
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.id));
}

export async function eventsOf(db: Executor, orderId: number) {
  return db
    .select({
      fromStatus: orderEvents.fromStatus,
      toStatus: orderEvents.toStatus,
      actorId: users.id,
      actorName: users.name,
      reason: orderEvents.reason,
      createdAt: orderEvents.createdAt,
    })
    .from(orderEvents)
    .leftJoin(users, eq(users.id, orderEvents.actorId))
    .where(eq(orderEvents.orderId, orderId))
    .orderBy(asc(orderEvents.createdAt), asc(orderEvents.id));
}

export interface OrderFilters {
  customerId?: number | undefined;
  statuses?: OrderStatus[] | undefined;
  q?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  limit: number;
  offset: number;
}

function filterConditions(filters: Omit<OrderFilters, 'limit' | 'offset'>, withStatus: boolean): SQL[] {
  const conditions: SQL[] = [];
  if (filters.customerId !== undefined) conditions.push(eq(orders.customerId, filters.customerId));
  if (withStatus && filters.statuses?.length) conditions.push(inArray(orders.status, filters.statuses));
  if (filters.from) conditions.push(gte(orders.createdAt, filters.from));
  if (filters.to) conditions.push(lte(orders.createdAt, filters.to));
  if (filters.q) {
    const digits = filters.q.replace(/\D/g, '');
    conditions.push(
      /^(rc-?)?\d+$/i.test(filters.q.trim())
        ? eq(orders.id, Number(digits))
        : ilike(users.searchText, `%${normalizeText(filters.q).replace(/[%_]/g, '')}%`),
    );
  }
  return conditions;
}

export async function listOrders(db: Executor, filters: OrderFilters) {
  const where = and(...filterConditions(filters, true));
  const itemCount = db
    .select({ orderId: orderItems.orderId, quantity: sum(orderItems.quantity).as('quantity') })
    .from(orderItems)
    .groupBy(orderItems.orderId)
    .as('item_count');
  const rows = await db
    .select({
      order: orders,
      customerName: users.name,
      customerDeleted: sql<boolean>`${users.deletedAt} is not null`,
      itemCount: sql<number>`coalesce(${itemCount.quantity}, 0)::int`,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.customerId))
    .leftJoin(itemCount, eq(itemCount.orderId, orders.id))
    .where(where)
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(filters.limit)
    .offset(filters.offset);
  const totals = await db
    .select({ value: count() })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.customerId))
    .where(where);
  const counts = await db
    .select({ status: orders.status, value: count() })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.customerId))
    .where(and(...filterConditions(filters, false)))
    .groupBy(orders.status);
  return { rows, total: totals[0]!.value, counts };
}
