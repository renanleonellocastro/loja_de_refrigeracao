import { and, count, desc, eq, isNull, type SQL } from 'drizzle-orm';
import type { Executor } from '../../infra/db/client.js';
import { notifications } from '../../infra/db/schema.js';

export async function insertNotification(
  db: Executor,
  values: typeof notifications.$inferInsert,
): Promise<void> {
  await db.insert(notifications).values(values);
}

const ownedBy = (userId: number) => eq(notifications.userId, userId);

const unreadOf = (userId: number) => and(ownedBy(userId), isNull(notifications.readAt));

async function countWhere(db: Executor, where: SQL | undefined): Promise<number> {
  const [total] = await db.select({ value: count() }).from(notifications).where(where);
  return total!.value;
}

function newestFirst(db: Executor, where: SQL | undefined, limit: number, offset: number) {
  return db
    .select()
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit)
    .offset(offset);
}

export async function listNotifications(
  db: Executor,
  userId: number,
  unreadOnly: boolean,
  limit: number,
  offset: number,
) {
  const where = unreadOnly ? unreadOf(userId) : ownedBy(userId);
  const [rows, total, unread] = await Promise.all([
    newestFirst(db, where, limit, offset),
    countWhere(db, where),
    countWhere(db, unreadOf(userId)),
  ]);
  return { rows, total, unread };
}

export async function markRead(db: Executor, userId: number, id: number, at: Date): Promise<boolean> {
  const rows = await db
    .update(notifications)
    .set({ readAt: at })
    .where(and(eq(notifications.id, id), ownedBy(userId)))
    .returning({ id: notifications.id });
  return rows.length > 0;
}

export async function markAllRead(db: Executor, userId: number, at: Date): Promise<void> {
  await db.update(notifications).set({ readAt: at }).where(unreadOf(userId));
}
