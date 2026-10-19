import { imageView } from '../media/service.js';
import type * as repo from './repository.js';
import { QUOTE_STATUS_LABELS, nextQuoteStatus, type QuotePerson } from './status.js';

type Person = Awaited<ReturnType<typeof repo.findPerson>>;
type QuoteListRow = Awaited<ReturnType<typeof repo.listQuotes>>['rows'][number];

export interface QuotePhoto {
  id: number;
  storageKey: string;
  width: number;
  height: number;
}

export interface QuoteRelations {
  serviceType: { id: number; name: string };
  customer: Person;
  photos: ReturnType<typeof photoView>[];
  answeredBy: Person | null;
  serviceRequestId: number | null;
}

export function photoView(photo: QuotePhoto) {
  return { id: photo.id, ...imageView({ key: photo.storageKey, width: photo.width, height: photo.height }) };
}

function timestampsOf(row: { createdAt: Date; updatedAt: Date }) {
  return { createdAt: row.createdAt, updatedAt: row.updatedAt };
}

function answerView(quote: repo.QuoteRow, answeredBy: Person | null) {
  return {
    amountCents: quote.amountCents,
    validUntil: quote.validUntil,
    included: quote.included,
    notes: quote.notes,
    answeredBy: answeredBy && { id: answeredBy.id, name: answeredBy.name },
    answeredAt: quote.answeredAt,
    decidedAt: quote.decidedAt,
    declineReason: quote.declineReason,
  };
}

function quoteHeaderView(quote: repo.QuoteRow, serviceType: QuoteRelations['serviceType']) {
  return {
    id: quote.id,
    status: quote.status,
    statusLabel: QUOTE_STATUS_LABELS[quote.status],
    serviceType,
    description: quote.description,
  };
}

/** What the viewer may do next; accepting also needs the quote to still be valid. */
export function quotePermissions(quote: repo.QuoteRow, actor: QuotePerson, isStillValid: boolean) {
  return {
    canAccept: nextQuoteStatus(quote.status, 'accept', actor) !== null && isStillValid,
    canDecline: nextQuoteStatus(quote.status, 'decline', actor) !== null,
    canCancel: nextQuoteStatus(quote.status, 'cancel', actor) !== null,
  };
}

export function quoteDetailView(
  quote: repo.QuoteRow,
  relations: QuoteRelations,
  permissions: ReturnType<typeof quotePermissions>,
) {
  return {
    ...quoteHeaderView(quote, relations.serviceType),
    photos: relations.photos,
    customer: relations.customer,
    ...answerView(quote, relations.answeredBy),
    serviceRequestId: relations.serviceRequestId,
    ...permissions,
    ...timestampsOf(quote),
  };
}

export function quoteListItemView(row: QuoteListRow) {
  return {
    id: row.id,
    status: row.status,
    statusLabel: QUOTE_STATUS_LABELS[row.status],
    serviceType: row.serviceType,
    customer: { id: row.customerId, name: row.customerName },
    amountCents: row.amountCents,
    validUntil: row.validUntil,
    ...timestampsOf(row),
  };
}
