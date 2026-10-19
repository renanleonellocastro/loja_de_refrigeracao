import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { recordAudit, type AuditEntry } from '../audit/service.js';
import * as notifications from '../notifications/service.js';
import type * as repo from './repository.js';

export const QUOTE_NOTICE_TYPE = 'quote';

export interface QuoteMessage {
  subject: string;
  heading: string;
  paragraphs: string[];
}

export const NO_REASON_GIVEN = 'O cliente não informou o motivo.';

export const customerQuotePath = (id: number) => `/minha-conta/orcamentos/${id}`;

/** Notifies every manager and super user (except the author of the change), in the app and by email. */
export function notifyManagement(
  ctx: AppContext,
  db: Executor,
  exceptUserId: number | null,
  quoteId: number,
  message: QuoteMessage,
) {
  return notifications.notifyManagement(ctx, db, exceptUserId, {
    type: QUOTE_NOTICE_TYPE,
    ...message,
    path: `/orcamentos/${quoteId}`,
    actionLabel: 'Abrir orçamento',
  });
}

/** Notifies the customer of the quote; removed accounts are skipped. */
export function notifyCustomer(
  ctx: AppContext,
  db: Executor,
  quote: repo.QuoteRow,
  message: QuoteMessage & { actionLabel?: string },
) {
  return notifications.notifyUserById(ctx, db, quote.customerId, {
    type: QUOTE_NOTICE_TYPE,
    actionLabel: 'Ver meu orçamento',
    ...message,
    path: customerQuotePath(quote.id),
  });
}

export function auditQuote(db: Executor, entry: Omit<AuditEntry, 'resourceType'>) {
  return recordAudit(db, { resourceType: 'quote', ...entry });
}
