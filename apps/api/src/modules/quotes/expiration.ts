import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { formatDateBr } from '../../shared/text.js';
import * as services from '../services/service.js';
import { notifyCustomer, notifyManagement } from './notices.js';
import * as repo from './repository.js';

function tellCustomer(ctx: AppContext, tx: Executor, quote: repo.QuoteRow, validUntil: string) {
  return notifyCustomer(ctx, tx, quote, {
    subject: `Seu orçamento nº ${quote.id} venceu`,
    heading: 'Orçamento vencido',
    paragraphs: [
      `A validade deste orçamento terminou em ${validUntil}.`,
      'Se ainda tiver interesse, peça um novo orçamento pelo site ou fale com a loja.',
    ],
  });
}

function tellManagement(ctx: AppContext, tx: Executor, quote: repo.QuoteRow, validUntil: string) {
  return notifyManagement(ctx, tx, null, quote.id, {
    subject: `Orçamento nº ${quote.id} venceu`,
    heading: 'Orçamento vencido sem resposta',
    paragraphs: [`O cliente não respondeu até ${validUntil}.`],
  });
}

async function announceExpiration(ctx: AppContext, tx: Executor, quote: repo.QuoteRow): Promise<void> {
  const validUntil = formatDateBr(quote.validUntil!);
  await tellCustomer(ctx, tx, quote, validUntil);
  await tellManagement(ctx, tx, quote, validUntil);
}

async function expireOverdue(ctx: AppContext, tx: Executor): Promise<number> {
  const now = ctx.clock.now();
  const expired = await repo.expireAnsweredBefore(tx, services.saoPauloDate(now), now);
  for (const quote of expired) await announceExpiration(ctx, tx, quote);
  return expired.length;
}

/**
 * Scheduled task: every answered quote whose last valid day (São Paulo) is before today becomes EXPIRED,
 * and the customer and the management are told. Returns how many quotes expired.
 */
export async function expireQuotes(ctx: AppContext): Promise<number> {
  return ctx.db.transaction((tx) => expireOverdue(ctx, tx));
}
