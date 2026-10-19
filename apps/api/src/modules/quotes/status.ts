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

/** A person acting on a quote through the site. */
export type QuotePerson = Exclude<QuoteActor, 'system'>;

export function quoteActor(role: Role): QuotePerson {
  return role === 'CLIENT' ? 'customer' : 'staff';
}

export function isFinalQuote(status: QuoteStatus): boolean {
  return status !== 'REQUESTED' && status !== 'ANSWERED';
}

type Transitions = Readonly<Partial<Record<QuoteStatus, QuoteStatus>>>;

/** Talking about a quote or adding photos keeps it where it is, while it is still open. */
const STAYS_OPEN: Transitions = { REQUESTED: 'REQUESTED', ANSWERED: 'ANSWERED' };

/**
 * The quote state machine of docs/DOMINIO.md, plus management cancelling open quotes:
 * for each action and actor, the status it leads to from each status.
 */
const QUOTE_TRANSITIONS: Readonly<Record<QuoteAction, Readonly<Partial<Record<QuoteActor, Transitions>>>>> = {
  staffMessage: { staff: STAYS_OPEN },
  staffPhotos: { staff: STAYS_OPEN },
  customerMessage: { customer: STAYS_OPEN },
  customerPhotos: { customer: { REQUESTED: 'REQUESTED' } },
  answer: { staff: { REQUESTED: 'ANSWERED' } },
  accept: { customer: { ANSWERED: 'ACCEPTED' } },
  decline: { customer: { ANSWERED: 'DECLINED' } },
  expire: { system: { ANSWERED: 'EXPIRED' } },
  cancel: { customer: { REQUESTED: 'CANCELED' }, staff: { REQUESTED: 'CANCELED', ANSWERED: 'CANCELED' } },
};

/** The next status, the same status when the action does not change it, or null when it is not allowed. */
export function nextQuoteStatus(
  current: QuoteStatus,
  action: QuoteAction,
  actor: QuoteActor,
): QuoteStatus | null {
  return QUOTE_TRANSITIONS[action][actor]?.[current] ?? null;
}
