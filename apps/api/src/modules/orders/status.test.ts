import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  nextOrderStatus,
  orderNumber,
  type OrderAction,
} from './status.js';

const ALLOWED: Record<string, string> = {
  'PENDING_REVIEW markReady staff': 'READY_FOR_PICKUP',
  'READY_FOR_PICKUP pickup staff': 'PICKED_UP',
  'PENDING_REVIEW cancel customer': 'CANCELED',
  'PENDING_REVIEW cancel staff': 'CANCELED',
  'READY_FOR_PICKUP cancel staff': 'CANCELED',
};
const ACTIONS: OrderAction[] = ['markReady', 'pickup', 'cancel'];

describe('order state machine', () => {
  const cases = ORDER_STATUSES.flatMap((s) =>
    ACTIONS.flatMap((a) => (['staff', 'customer'] as const).map((r) => [s, a, r] as const)),
  );
  it.each(cases)('%s + %s by %s', (status, action, actor) => {
    expect(nextOrderStatus(status, action, actor)).toBe(ALLOWED[`${status} ${action} ${actor}`] ?? null);
  });

  it('labels statuses and formats order numbers', () => {
    expect(Object.keys(ORDER_STATUS_LABELS)).toEqual([...ORDER_STATUSES]);
    expect(orderNumber(123)).toBe('RC-000123');
    expect(orderNumber(1234567)).toBe('RC-1234567');
  });
});
