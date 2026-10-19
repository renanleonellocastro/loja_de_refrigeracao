import type { Role } from '@rc/contracts';
import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { queueEmail, type NoticeEmail } from '../mail/service.js';
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

const NOTIFICATION_BODY_MAX_LENGTH = 500;
const MANAGEMENT_ROLES: Role[] = ['MANAGER', 'ADMIN'];
const STORE_TEAM_NAME = 'equipe';

function noticeEmail(ctx: AppContext, name: string, notice: Notice): NoticeEmail {
  return {
    name,
    subject: notice.subject,
    heading: notice.heading ?? notice.subject,
    paragraphs: notice.paragraphs,
    ...(notice.path ? { link: `${ctx.config.APP_ORIGIN}${notice.path}` } : {}),
  };
}

function notificationOf(ctx: AppContext, recipient: Recipient, notice: Notice) {
  return {
    userId: recipient.id,
    type: notice.type,
    title: notice.subject,
    body: notice.paragraphs.join(' ').slice(0, NOTIFICATION_BODY_MAX_LENGTH),
    link: notice.path ?? null,
    createdAt: ctx.clock.now(),
  };
}

/** In-app notification plus branded email, in the same transaction as the change (outbox). */
export async function notifyUser(
  ctx: AppContext,
  db: Executor,
  recipient: Recipient,
  notice: Notice,
): Promise<void> {
  await insertNotification(db, notificationOf(ctx, recipient, notice));
  await queueEmail(db, recipient.email, 'notice', {
    ...noticeEmail(ctx, recipient.name, notice),
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

/** Emails the store notification addresses that do not belong to an account already notified. */
async function emailStoreAddresses(ctx: AppContext, db: Executor, notifiedEmails: string[], notice: Notice) {
  const notified = new Set(notifiedEmails.map((email) => email.toLowerCase()));
  const pending = (await storeNotificationEmails(db)).filter((email) => !notified.has(email.toLowerCase()));
  for (const email of pending) {
    await queueEmail(db, email, 'notice', noticeEmail(ctx, STORE_TEAM_NAME, notice));
  }
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
  for (const person of people.filter(({ id }) => id !== exceptUserId)) {
    await notifyUser(ctx, db, person, notice);
  }
  await emailStoreAddresses(
    ctx,
    db,
    people.map(({ email }) => email),
    notice,
  );
}

export const notifyManagement = (
  ctx: AppContext,
  db: Executor,
  exceptUserId: number | null,
  notice: Notice,
) => notifyRoles(ctx, db, MANAGEMENT_ROLES, exceptUserId, notice);
