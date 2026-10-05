import type { Quote, QuoteListItem } from '~/utils/quotes';
import { IMAGE } from './shop';

/** Quotes as the API answers them (packages/contracts/openapi.json). */

export const quote = (overrides: Partial<Quote> = {}): Quote => ({
  id: 31,
  status: 'REQUESTED',
  statusLabel: 'Solicitado',
  serviceType: { id: 1, name: 'Conserto de geladeira' },
  description: 'Instalar um split de 12.000 BTUs na sala.',
  photos: [{ ...IMAGE, id: 7 }],
  customer: { id: 4, name: 'Carla Cliente', email: 'cliente@castro.dev', phone: '19999998888' },
  amountCents: null,
  validUntil: null,
  included: null,
  notes: null,
  answeredBy: null,
  answeredAt: null,
  decidedAt: null,
  declineReason: null,
  serviceRequestId: null,
  canAccept: false,
  canDecline: false,
  canCancel: true,
  createdAt: '2026-10-04T13:00:00.000Z',
  updatedAt: '2026-10-04T13:00:00.000Z',
  ...overrides,
});

/** A quote answered by the store with a value of R$ 1.234,56 valid until 15/10/2026. */
export const answeredQuote = (overrides: Partial<Quote> = {}): Quote =>
  quote({
    status: 'ANSWERED',
    statusLabel: 'Respondido',
    amountCents: 123456,
    validUntil: '2026-10-15',
    included: 'Mão de obra e suporte.',
    notes: 'Pagamento na hora.',
    answeredBy: { id: 2, name: 'Marina Gerente' },
    answeredAt: '2026-10-04T15:00:00.000Z',
    canAccept: true,
    canDecline: true,
    canCancel: false,
    ...overrides,
  });

export const quoteListItem = (overrides: Partial<QuoteListItem> = {}): QuoteListItem => ({
  id: 31,
  status: 'REQUESTED',
  statusLabel: 'Solicitado',
  serviceType: 'Conserto de geladeira',
  customer: { id: 4, name: 'Carla Cliente' },
  amountCents: null,
  validUntil: null,
  createdAt: '2026-10-04T13:00:00.000Z',
  updatedAt: '2026-10-04T13:00:00.000Z',
  ...overrides,
});
