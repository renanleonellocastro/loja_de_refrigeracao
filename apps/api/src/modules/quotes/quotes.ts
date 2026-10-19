import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { pageOf, toLimitOffset } from '../../shared/pagination.js';
import type { AccessClaims } from '../auth/service.js';
import * as services from '../services/service.js';
import { isWithinValidity, loadVisible } from './access.js';
import { photosOf } from './conversation.js';
import * as repo from './repository.js';
import { quoteActor, type QuoteStatus } from './status.js';
import { quoteDetailView, quoteListItemView, quotePermissions, type QuoteRelations } from './views.js';

export interface QuoteListQuery {
  status?: QuoteStatus[] | undefined;
  q?: string | undefined;
  page: number;
  pageSize: number;
}

async function loadRelations(db: Executor, quote: repo.QuoteRow): Promise<QuoteRelations> {
  const [type, customer, photos, answeredBy, serviceRequestId] = await Promise.all([
    services.findServiceType(db, quote.serviceTypeId),
    repo.findPerson(db, quote.customerId),
    photosOf(db, quote.id),
    quote.answeredById === null ? null : repo.findPerson(db, quote.answeredById),
    repo.findRequestIdForQuote(db, quote.id),
  ]);
  return { serviceType: { id: type!.id, name: type!.name }, customer, photos, answeredBy, serviceRequestId };
}

export async function quoteDetail(ctx: AppContext, viewer: AccessClaims, id: number) {
  const quote = await loadVisible(ctx.db, viewer, id);
  const relations = await loadRelations(ctx.db, quote);
  const isStillValid = isWithinValidity(quote, ctx.clock.now());
  return quoteDetailView(quote, relations, quotePermissions(quote, quoteActor(viewer.role), isStillValid));
}

/** Customers list only their own quotes and cannot search by customer. */
function visibleFilters(viewer: AccessClaims, query: QuoteListQuery): repo.QuoteFilters {
  const isCustomer = viewer.role === 'CLIENT';
  return {
    customerId: isCustomer ? viewer.userId : undefined,
    statuses: query.status,
    q: isCustomer ? undefined : query.q,
    ...toLimitOffset(query),
  };
}

export async function listVisibleQuotes(ctx: AppContext, viewer: AccessClaims, query: QuoteListQuery) {
  const { rows, total } = await repo.listQuotes(ctx.db, visibleFilters(viewer, query));
  return pageOf(rows.map(quoteListItemView), query, total);
}
