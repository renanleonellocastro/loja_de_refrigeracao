import type { Role } from '@rc/contracts';
import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { queueEmail } from '../mail/service.js';
import { storeNotificationEmails } from '../store/service.js';
import * as users from '../users/service.js';
import { insertNotification } from './repository.js';

export interface Notice {
  /** Machine readable kind, for icons and filters (for example "serviceRequest.approved"). */
  type: string;
  subject: string;
  heading?: string;
  paragraphs: string[];
  /** Path inside the site, like /minha-conta/agendamentos/12. */
  path?: string;
  actionLabel?: string;
}

interface Recipient {
  id: number;
  name: string;
  email: string;
}

/** In-app notification plus branded email, in the same transaction as the change (outbox). */
export async function notifyUser(
  ctx: AppContext,
  db: Executor,
  recipient: Recipient,
  notice: Notice,
): Promise<void> {
  await insertNotification(db, {
    userId: recipient.id,
    type: notice.type,
    title: notice.subject,
    body: notice.paragraphs.join(' ').slice(0, 500),
    link: notice.path ?? null,
    createdAt: ctx.clock.now(),
  });
  await queueEmail(db, recipient.email, 'notice', {
    name: recipient.name,
    subject: notice.subject,
    heading: notice.heading ?? notice.subject,
    paragraphs: notice.paragraphs,
    ...(notice.path ? { link: `${ctx.config.APP_ORIGIN}${notice.path}` } : {}),
    ...(notice.actionLabel ? { actionLabel: notice.actionLabel } : {}),
  });
}

/** Notifies an account by id; silently skips removed accounts. */
export async function notifyUserById(
  ctx: AppContext,
  db: Executor,
  userId: number,
  notice: Notice,
): Promise<void> {
  const user = await users.findActiveUserById(db, userId);
  if (user) await notifyUser(ctx, db, user, notice);
}

/**
 * Notifies every active user with the roles (except the author) and also emails the store
 * notification addresses configured by the super user.
 */
export async function notifyRoles(
  ctx: AppContext,
  db: Executor,
  roles: Role[],
  exceptUserId: number | null,
  notice: Notice,
): Promise<void> {
  const people = await users.activeEmailsByRole(db, roles);
  for (const person of people) {
    if (person.id !== exceptUserId) await notifyUser(ctx, db, person, notice);
  }
  const already = new Set(people.map((p) => p.email.toLowerCase()));
  for (const email of await storeNotificationEmails(db)) {
    if (already.has(email.toLowerCase())) continue;
    await queueEmail(db, email, 'notice', {
      name: 'equipe',
      subject: notice.subject,
      heading: notice.heading ?? notice.subject,
      paragraphs: notice.paragraphs,
      ...(notice.path ? { link: `${ctx.config.APP_ORIGIN}${notice.path}` } : {}),
    });
  }
}

export const notifyManagement = (
  ctx: AppContext,
  db: Executor,
  exceptUserId: number | null,
  notice: Notice,
) => notifyRoles(ctx, db, ['MANAGER', 'ADMIN'], exceptUserId, notice);
