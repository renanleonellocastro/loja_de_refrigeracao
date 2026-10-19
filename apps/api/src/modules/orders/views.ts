import type * as users from '../users/service.js';
import type * as repo from './repository.js';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, orderNumber, type OrderStatus } from './status.js';

const REMOVED_ACCOUNT_NAME = 'Conta removida';

type OrderItemRow = Awaited<ReturnType<typeof repo.itemsOf>>[number];
type OrderEventRow = Awaited<ReturnType<typeof repo.eventsOf>>[number];
type OrderListRow = Awaited<ReturnType<typeof repo.listOrders>>['rows'][number];
type StatusCount = Awaited<ReturnType<typeof repo.listOrders>>['counts'][number];

export interface OrderRelations {
  items: OrderItemRow[];
  events: OrderEventRow[];
  customer: users.UserRow | undefined;
}

function orderHeaderView(order: repo.OrderRow) {
  return {
    id: order.id,
    number: orderNumber(order.id),
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    channel: order.channel,
  };
}

function customerView(order: repo.OrderRow, customer: users.UserRow | undefined) {
  if (!customer) return { id: order.customerId, name: REMOVED_ACCOUNT_NAME, email: '', phone: null };
  return { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone };
}

function itemView(item: OrderItemRow) {
  return {
    productId: item.productId,
    productName: item.productName,
    unitPriceCents: item.unitPriceCents,
    quantity: item.quantity,
    subtotalCents: item.unitPriceCents * item.quantity,
  };
}

function eventView(event: OrderEventRow) {
  return {
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    label: ORDER_STATUS_LABELS[event.toStatus],
    actor: event.actorId === null ? null : { id: event.actorId, name: event.actorName! },
    reason: event.reason,
    createdAt: event.createdAt,
  };
}

export function orderDetailView(order: repo.OrderRow, relations: OrderRelations, canCancel: boolean) {
  return {
    ...orderHeaderView(order),
    customer: customerView(order, relations.customer),
    items: relations.items.map(itemView),
    totalCents: order.totalCents,
    notes: order.notes,
    events: relations.events.map(eventView),
    canCancel,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function orderListItemView({ order, customerDeleted, customerName, itemCount }: OrderListRow) {
  return {
    ...orderHeaderView(order),
    customer: { id: order.customerId, name: customerDeleted ? REMOVED_ACCOUNT_NAME : customerName },
    totalCents: order.totalCents,
    itemCount,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

/** Orders per status, with zero for the statuses that have none. */
export function statusCounts(counts: StatusCount[]): Record<OrderStatus, number> {
  const countOf = (status: OrderStatus) => counts.find((row) => row.status === status)?.value ?? 0;
  return Object.fromEntries(ORDER_STATUSES.map((status) => [status, countOf(status)])) as Record<
    OrderStatus,
    number
  >;
}
