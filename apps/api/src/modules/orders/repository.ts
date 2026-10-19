import { and, asc, count, desc, eq, gte, ilike, inArray, lte, sql, sum, type SQL } from 'drizzle-orm';
import type { Executor } from '../../infra/db/client.js';
import { cartItems, orderEvents, orderItems, orders, users } from '../../infra/db/schema.js';
import { normalizeText, onlyDigits } from '../../shared/text.js';
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

const EVENT_COLUMNS = {
  fromStatus: orderEvents.fromStatus,
  toStatus: orderEvents.toStatus,
  actorId: users.id,
  actorName: users.name,
  reason: orderEvents.reason,
  createdAt: orderEvents.createdAt,
};

export async function eventsOf(db: Executor, orderId: number) {
  return db
    .select(EVENT_COLUMNS)
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

/** "RC-000123", "rc123" or "123" search the order number; anything else searches the customer. */
const ORDER_NUMBER_SEARCH = /^(rc-?)?\d+$/i;

function searchCondition(q: string): SQL {
  if (ORDER_NUMBER_SEARCH.test(q.trim())) return eq(orders.id, Number(onlyDigits(q)));
  return ilike(users.searchText, `%${normalizeText(q).replace(/[%_]/g, '')}%`);
}

/** Every filter except the status, so the per status counts ignore the chosen statuses. */
function scopeConditions(filters: OrderFilters): Array<SQL | undefined> {
  return [
    filters.customerId === undefined ? undefined : eq(orders.customerId, filters.customerId),
    filters.from ? gte(orders.createdAt, filters.from) : undefined,
    filters.to ? lte(orders.createdAt, filters.to) : undefined,
    filters.q ? searchCondition(filters.q) : undefined,
  ];
}

function statusCondition(statuses: OrderStatus[] | undefined): SQL | undefined {
  return statuses?.length ? inArray(orders.status, statuses) : undefined;
}

function itemCountsByOrder(db: Executor) {
  return db
    .select({ orderId: orderItems.orderId, quantity: sum(orderItems.quantity).as('quantity') })
    .from(orderItems)
    .groupBy(orderItems.orderId)
    .as('item_count');
}

type ItemCounts = ReturnType<typeof itemCountsByOrder>;

function listColumns(itemCount: ItemCounts) {
  return {
    order: orders,
    customerName: users.name,
    customerDeleted: sql<boolean>`${users.deletedAt} is not null`,
    itemCount: sql<number>`coalesce(${itemCount.quantity}, 0)::int`,
  };
}

function pageOfOrders(db: Executor, where: SQL | undefined, filters: OrderFilters) {
  const itemCount = itemCountsByOrder(db);
  return db
    .select(listColumns(itemCount))
    .from(orders)
    .innerJoin(users, eq(users.id, orders.customerId))
    .leftJoin(itemCount, eq(itemCount.orderId, orders.id))
    .where(where)
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(filters.limit)
    .offset(filters.offset);
}

async function countOrders(db: Executor, where: SQL | undefined): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.customerId))
    .where(where);
  return row!.value;
}

function countByStatus(db: Executor, where: SQL | undefined) {
  return db
    .select({ status: orders.status, value: count() })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.customerId))
    .where(where)
    .groupBy(orders.status);
}

export async function listOrders(db: Executor, filters: OrderFilters) {
  const scope = scopeConditions(filters);
  const where = and(...scope, statusCondition(filters.statuses));
  const rows = await pageOfOrders(db, where, filters);
  const total = await countOrders(db, where);
  const counts = await countByStatus(db, and(...scope));
  return { rows, total, counts };
}
