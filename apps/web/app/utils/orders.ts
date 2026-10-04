import type { ApiSchemas } from '@rc/contracts';
import { formatDateTime } from './masks';
import { statusMeta } from './status';
import type { TimelineEvent } from './types';

export type Order = ApiSchemas['Order'];
export type OrderListItem = ApiSchemas['OrderListItem'];

/** Status history of an order for BaseTimeline, newest first, with the reason of a cancellation. */
export function orderTimeline(order: Order): TimelineEvent[] {
  return order.events
    .map((event, index) => ({
      id: index,
      title: event.label,
      when: formatDateTime(event.createdAt),
      datetime: event.createdAt,
      description: event.reason ?? undefined,
      icon: statusMeta('order', event.toStatus).icon,
    }))
    .reverse();
}

/** What happens next, in the words of the counter, for each status of an order. */
export const ORDER_NEXT_STEP: Record<Order['status'], string> = {
  PENDING_REVIEW: 'A loja está conferindo seu pedido. Você recebe um aviso quando ele estiver separado.',
  READY_FOR_PICKUP: 'Seu pedido está separado. Passe na loja para retirar e pagar.',
  PICKED_UP: 'Pedido retirado. Obrigado pela preferência!',
  CANCELED: 'Este pedido foi cancelado e os itens voltaram para o estoque.',
};
