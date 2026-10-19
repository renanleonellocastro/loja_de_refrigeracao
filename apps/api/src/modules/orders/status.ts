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

type Transitions = Readonly<Partial<Record<OrderStatus, OrderStatus>>>;

/** Order state machine of docs/DOMINIO.md: for each action and actor, the status it leads to from each status. */
const ORDER_TRANSITIONS: Readonly<Record<OrderAction, Readonly<Record<OrderActor, Transitions>>>> = {
  markReady: { staff: { PENDING_REVIEW: 'READY_FOR_PICKUP' }, customer: {} },
  pickup: { staff: { READY_FOR_PICKUP: 'PICKED_UP' }, customer: {} },
  cancel: {
    staff: { PENDING_REVIEW: 'CANCELED', READY_FOR_PICKUP: 'CANCELED' },
    customer: { PENDING_REVIEW: 'CANCELED' },
  },
};

/** The status the action leads to; null when the action is not allowed. */
export function nextOrderStatus(
  current: OrderStatus,
  action: OrderAction,
  actor: OrderActor,
): OrderStatus | null {
  return ORDER_TRANSITIONS[action][actor][current] ?? null;
}

const ORDER_NUMBER_PREFIX = 'RC-';
const ORDER_NUMBER_DIGITS = 6;

/** RC-000123 */
export function orderNumber(id: number): string {
  return `${ORDER_NUMBER_PREFIX}${String(id).padStart(ORDER_NUMBER_DIGITS, '0')}`;
}
