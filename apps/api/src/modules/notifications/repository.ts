import { and, count, desc, eq, isNull } from 'drizzle-orm';
import type { Executor } from '../../infra/db/client.js';
import { notifications } from '../../infra/db/schema.js';

export async function insertNotification(
  db: Executor,
  values: typeof notifications.$inferInsert,
): Promise<void> {
  await db.insert(notifications).values(values);
}

export async function listNotifications(
  db: Executor,
  userId: number,
  unreadOnly: boolean,
  limit: number,
  offset: number,
) {
  const where = unreadOnly
    ? and(eq(notifications.userId, userId), isNull(notifications.readAt))
    : eq(notifications.userId, userId);
  const [rows, totals, unread] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(notifications).where(where),
    db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);
  return { rows, total: totals[0]!.value, unread: unread[0]!.value };
}

export async function markRead(db: Executor, userId: number, id: number, at: Date): Promise<boolean> {
  const rows = await db
    .update(notifications)
    .set({ readAt: at })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning({ id: notifications.id });
  return rows.length > 0;
}

export async function markAllRead(db: Executor, userId: number, at: Date): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: at })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
