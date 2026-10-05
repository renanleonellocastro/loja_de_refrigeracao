import type { ApiSchemas } from '@rc/contracts';
import type { QuoteStatus } from './status';

export type Quote = ApiSchemas['Quote'];
export type QuoteListItem = ApiSchemas['QuoteListItem'];

/** Limits of the API (apps/api quotes module). */
export const MAX_QUOTE_PHOTOS = 6;
export const QUOTES_PAGE_SIZE = 20;
export const MIN_VALIDITY_DAYS = 1;
export const MAX_VALIDITY_DAYS = 90;
export const DEFAULT_VALIDITY_DAYS = 15;

/** The conversation and the photos stay open while the quote waits for the store or for the customer. */
export function isOpenQuote(status: QuoteStatus): boolean {
  return status === 'REQUESTED' || status === 'ANSWERED';
}

const dayFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

/** The last day of a quote ("2026-10-15") as "15/10/2026". */
export function formatValidUntil(day: string): string {
  return dayFormatter.format(new Date(`${day}T12:00:00Z`));
}

/** What happens next, in the words of the counter, for each status of a quote (customer view). */
export const QUOTE_NEXT_STEP: Record<QuoteStatus, string> = {
  REQUESTED: 'A loja está preparando seu orçamento. A gente responde em até 1 dia útil.',
  ANSWERED: 'Seu orçamento está pronto. Confira o valor e o que está incluído, e aceite ou recuse.',
  ACCEPTED: 'Orçamento aceito! Criamos o pedido de visita com as datas que você escolheu.',
  DECLINED: 'Você recusou este orçamento.',
  EXPIRED: 'A validade deste orçamento terminou. Peça um novo se ainda precisar do serviço.',
  CANCELED: 'Este orçamento foi cancelado.',
};
