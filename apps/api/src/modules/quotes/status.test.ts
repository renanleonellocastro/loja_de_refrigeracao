import { describe, expect, it } from 'vitest';
import {
  QUOTE_STATUSES,
  QUOTE_STATUS_LABELS,
  isFinalQuote,
  nextQuoteStatus,
  quoteActor,
  type QuoteAction,
  type QuoteStatus,
} from './status.js';

const ACTIONS: QuoteAction[] = [
  'staffMessage',
  'customerMessage',
  'staffPhotos',
  'customerPhotos',
  'answer',
  'accept',
  'decline',
  'expire',
  'cancel',
];

/** Every allowed transition, written out from docs/DOMINIO.md. Anything not listed must be refused. */
const ALLOWED: Record<string, QuoteStatus> = {
  'REQUESTED staffMessage staff': 'REQUESTED',
  'ANSWERED staffMessage staff': 'ANSWERED',
  'REQUESTED customerMessage customer': 'REQUESTED',
  'ANSWERED customerMessage customer': 'ANSWERED',
  'REQUESTED staffPhotos staff': 'REQUESTED',
  'ANSWERED staffPhotos staff': 'ANSWERED',
  'REQUESTED customerPhotos customer': 'REQUESTED',
  'REQUESTED answer staff': 'ANSWERED',
  'ANSWERED accept customer': 'ACCEPTED',
  'ANSWERED decline customer': 'DECLINED',
  'ANSWERED expire system': 'EXPIRED',
  'REQUESTED cancel customer': 'CANCELED',
  'REQUESTED cancel staff': 'CANCELED',
  'ANSWERED cancel staff': 'CANCELED',
};

describe('quote state machine', () => {
  const cases = QUOTE_STATUSES.flatMap((status) =>
    ACTIONS.flatMap((action) =>
      (['staff', 'customer', 'system'] as const).map((actor) => [status, action, actor] as const),
    ),
  );

  it.each(cases)('%s + %s by %s', (status, action, actor) => {
    expect(nextQuoteStatus(status, action, actor)).toBe(ALLOWED[`${status} ${action} ${actor}`] ?? null);
  });

  it('labels every status in Portuguese, knows the final ones and maps roles to actors', () => {
    expect(Object.keys(QUOTE_STATUS_LABELS)).toEqual([...QUOTE_STATUSES]);
    expect(QUOTE_STATUSES.filter(isFinalQuote)).toEqual(['ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELED']);
    expect(quoteActor('CLIENT')).toBe('customer');
    expect(quoteActor('MANAGER')).toBe('staff');
  });
});
