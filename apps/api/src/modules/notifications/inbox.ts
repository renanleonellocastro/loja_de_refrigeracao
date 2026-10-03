import type { AppContext } from '../../context.js';
import { notFound } from '../../shared/errors.js';
import * as repo from './repository.js';

export async function listInbox(
  ctx: AppContext,
  userId: number,
  query: { page: number; pageSize: number; unread?: 'true' | 'false' | undefined },
) {
  const { page, pageSize } = query;
  const result = await repo.listNotifications(
    ctx.db,
    userId,
    query.unread === 'true',
    pageSize,
    (page - 1) * pageSize,
  );
  return { data: result.rows, meta: { page, pageSize, total: result.total, unread: result.unread } };
}

export async function markNotificationRead(ctx: AppContext, userId: number, id: number): Promise<void> {
  if (!(await repo.markRead(ctx.db, userId, id, ctx.clock.now())))
    throw notFound('Notificação não encontrada.');
}

export function markAllNotificationsRead(ctx: AppContext, userId: number): Promise<void> {
  return repo.markAllRead(ctx.db, userId, ctx.clock.now());
}
