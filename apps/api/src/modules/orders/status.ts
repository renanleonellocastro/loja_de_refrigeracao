export const ORDER_STATUSES = ['PENDING_REVIEW', 'READY_FOR_PICKUP', 'PICKED_UP', 'CANCELED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_REVIEW: 'Em análise',
  READY_FOR_PICKUP: 'Aguardando retirada',
  PICKED_UP: 'Retirado',
  CANCELED: 'Cancelado',
};

export type OrderAction = 'markReady' | 'pickup' | 'cancel';
export type OrderActor = 'customer' | 'staff';

/** Order state machine of docs/DOMINIO.md; null when the action is not allowed. */
export function nextOrderStatus(
  current: OrderStatus,
  action: OrderAction,
  actor: OrderActor,
): OrderStatus | null {
  switch (action) {
    case 'markReady':
      return actor === 'staff' && current === 'PENDING_REVIEW' ? 'READY_FOR_PICKUP' : null;
    case 'pickup':
      return actor === 'staff' && current === 'READY_FOR_PICKUP' ? 'PICKED_UP' : null;
    case 'cancel':
      if (current === 'PENDING_REVIEW') return 'CANCELED';
      return actor === 'staff' && current === 'READY_FOR_PICKUP' ? 'CANCELED' : null;
  }
}

/** RC-000123 */
export function orderNumber(id: number): string {
  return `RC-${String(id).padStart(6, '0')}`;
}
