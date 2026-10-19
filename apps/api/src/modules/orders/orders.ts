import type { AppContext } from '../../context.js';
import { toLimitOffset } from '../../shared/pagination.js';
import type { AccessClaims } from '../auth/service.js';
import * as users from '../users/service.js';
import { canCancel, isManagement, loadVisible } from './access.js';
import * as repo from './repository.js';
import type { OrderStatus } from './status.js';
import { orderDetailView, orderListItemView, statusCounts } from './views.js';

export interface OrderListQuery {
  status?: OrderStatus[] | undefined;
  q?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  page: number;
  pageSize: number;
}

export async function orderDetail(ctx: AppContext, viewer: AccessClaims, id: number) {
  const order = await loadVisible(ctx.db, viewer, id);
  const [items, events, customer] = await Promise.all([
    repo.itemsOf(ctx.db, id),
    repo.eventsOf(ctx.db, id),
    users.findActiveUserById(ctx.db, order.customerId),
  ]);
  return orderDetailView(order, { items, events, customer }, canCancel(viewer, order));
}

/** Customers list only their own orders and cannot search by customer. */
function visibleFilters(viewer: AccessClaims, query: OrderListQuery): repo.OrderFilters {
  const management = isManagement(viewer.role);
  return {
    customerId: management ? undefined : viewer.userId,
    statuses: query.status,
    q: management ? query.q : undefined,
    from: query.from,
    to: query.to,
    ...toLimitOffset(query),
  };
}

export async function listVisibleOrders(ctx: AppContext, viewer: AccessClaims, query: OrderListQuery) {
  const { rows, total, counts } = await repo.listOrders(ctx.db, visibleFilters(viewer, query));
  return {
    data: rows.map(orderListItemView),
    meta: { page: query.page, pageSize: query.pageSize, total, counts: statusCounts(counts) },
  };
}
