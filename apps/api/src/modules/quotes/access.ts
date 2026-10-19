import type { Role } from '@rc/contracts';
import type { Executor } from '../../infra/db/client.js';
import { conflict, notFound } from '../../shared/errors.js';
import type { AccessClaims } from '../auth/service.js';
import * as services from '../services/service.js';
import * as repo from './repository.js';
import {
  QUOTE_STATUS_LABELS,
  nextQuoteStatus,
  type QuoteAction,
  type QuoteActor,
  type QuoteStatus,
} from './status.js';

function isManagement(role: Role): boolean {
  return role === 'MANAGER' || role === 'ADMIN';
}

/** The customer sees their own quotes and management sees any; everyone else gets 404. */
function visibleOrFail(viewer: AccessClaims, quote: repo.QuoteRow | undefined): repo.QuoteRow {
  if (quote && (isManagement(viewer.role) || quote.customerId === viewer.userId)) return quote;
  throw notFound('Orçamento não encontrado.');
}

export async function loadVisible(db: Executor, viewer: AccessClaims, id: number): Promise<repo.QuoteRow> {
  return visibleOrFail(viewer, await repo.findQuote(db, id));
}

/** Like loadVisible, and locks the quote until the transaction ends so two decisions cannot race. */
export async function lockVisible(db: Executor, viewer: AccessClaims, id: number): Promise<repo.QuoteRow> {
  return visibleOrFail(viewer, await repo.findQuoteForUpdate(db, id));
}

/** Answered quotes can be accepted up to and including their last valid day in São Paulo. */
export function isWithinValidity(quote: repo.QuoteRow, now: Date): boolean {
  return quote.validUntil! >= services.saoPauloDate(now);
}

function invalidTransition(status: QuoteStatus) {
  return conflict(
    'invalid-transition',
    'Ação indisponível',
    `Não é possível fazer isso com um orçamento ${QUOTE_STATUS_LABELS[status].toLowerCase()}.`,
  );
}

export function nextOrFail(quote: repo.QuoteRow, action: QuoteAction, actor: QuoteActor): QuoteStatus {
  const next = nextQuoteStatus(quote.status, action, actor);
  if (next === null) throw invalidTransition(quote.status);
  return next;
}
