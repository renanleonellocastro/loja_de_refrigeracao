import type { Role } from '@rc/contracts';

export const QUOTE_STATUSES = [
  'REQUESTED',
  'ANSWERED',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'CANCELED',
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  REQUESTED: 'Solicitado',
  ANSWERED: 'Respondido',
  ACCEPTED: 'Aceito',
  DECLINED: 'Recusado',
  EXPIRED: 'Vencido',
  CANCELED: 'Cancelado',
};

export type QuoteAction =
  | 'staffMessage'
  | 'customerMessage'
  | 'staffPhotos'
  | 'customerPhotos'
  | 'answer'
  | 'accept'
  | 'decline'
  | 'expire'
  | 'cancel';

/** Who acts on a quote: the customer, the store staff or the scheduled expiration task. */
export type QuoteActor = 'customer' | 'staff' | 'system';

export function quoteActor(role: Role): QuoteActor {
  return role === 'CLIENT' ? 'customer' : 'staff';
}

export function isFinalQuote(status: QuoteStatus): boolean {
  return status !== 'REQUESTED' && status !== 'ANSWERED';
}

/**
 * The quote state machine of docs/DOMINIO.md, plus management cancelling open quotes.
 * Returns the next status, the same status when the action does not change it, or null when it is not allowed.
 */
export function nextQuoteStatus(
  current: QuoteStatus,
  action: QuoteAction,
  actor: QuoteActor,
): QuoteStatus | null {
  const open = !isFinalQuote(current);
  switch (action) {
    case 'staffMessage':
    case 'staffPhotos':
      return actor === 'staff' && open ? current : null;
    case 'customerMessage':
      return actor === 'customer' && open ? current : null;
    case 'customerPhotos':
      return actor === 'customer' && current === 'REQUESTED' ? current : null;
    case 'answer':
      return actor === 'staff' && current === 'REQUESTED' ? 'ANSWERED' : null;
    case 'accept':
      return actor === 'customer' && current === 'ANSWERED' ? 'ACCEPTED' : null;
    case 'decline':
      return actor === 'customer' && current === 'ANSWERED' ? 'DECLINED' : null;
    case 'expire':
      return actor === 'system' && current === 'ANSWERED' ? 'EXPIRED' : null;
    case 'cancel':
      if (actor === 'customer') return current === 'REQUESTED' ? 'CANCELED' : null;
      return actor === 'staff' && open ? 'CANCELED' : null;
  }
}
