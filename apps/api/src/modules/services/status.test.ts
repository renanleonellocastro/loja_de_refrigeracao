import { describe, expect, it } from 'vitest';
import {
  REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  actorKind,
  customerCancellationDeadline,
  nextRequestStatus,
  saoPauloDate,
  type RequestAction,
  type RequestStatus,
} from './status.js';

const ACTIONS: RequestAction[] = [
  'staffMessage',
  'customerMessage',
  'approve',
  'reject',
  'schedule',
  'unschedule',
  'submitReport',
  'approveReport',
  'requestRework',
  'cancel',
];

/** Every allowed transition, written out from docs/DOMINIO.md. Anything not listed must be refused. */
const ALLOWED: Record<string, RequestStatus> = {
  'REQUESTED staffMessage staff': 'AWAITING_CUSTOMER',
  'AWAITING_CUSTOMER staffMessage staff': 'AWAITING_CUSTOMER',
  'APPROVED staffMessage staff': 'APPROVED',
  'SCHEDULED staffMessage staff': 'SCHEDULED',
  'AWAITING_COMPLETION_APPROVAL staffMessage staff': 'AWAITING_COMPLETION_APPROVAL',
  'AWAITING_CUSTOMER customerMessage customer': 'REQUESTED',
  'REQUESTED customerMessage customer': 'REQUESTED',
  'APPROVED customerMessage customer': 'APPROVED',
  'SCHEDULED customerMessage customer': 'SCHEDULED',
  'AWAITING_COMPLETION_APPROVAL customerMessage customer': 'AWAITING_COMPLETION_APPROVAL',
  'REQUESTED approve staff': 'APPROVED',
  'AWAITING_CUSTOMER approve staff': 'APPROVED',
  'REQUESTED reject staff': 'REJECTED',
  'AWAITING_CUSTOMER reject staff': 'REJECTED',
  'APPROVED schedule staff': 'SCHEDULED',
  'SCHEDULED unschedule staff': 'APPROVED',
  'SCHEDULED submitReport staff': 'AWAITING_COMPLETION_APPROVAL',
  'AWAITING_COMPLETION_APPROVAL approveReport staff': 'COMPLETED',
  'AWAITING_COMPLETION_APPROVAL requestRework staff': 'SCHEDULED',
  'REQUESTED cancel customer': 'CANCELED',
  'AWAITING_CUSTOMER cancel customer': 'CANCELED',
  'APPROVED cancel customer': 'CANCELED',
  'SCHEDULED cancel customer': 'CANCELED',
  'REQUESTED cancel staff': 'CANCELED',
  'AWAITING_CUSTOMER cancel staff': 'CANCELED',
  'APPROVED cancel staff': 'CANCELED',
  'SCHEDULED cancel staff': 'CANCELED',
};

describe('service request state machine', () => {
  const cases = REQUEST_STATUSES.flatMap((status) =>
    ACTIONS.flatMap((action) =>
      (['staff', 'customer'] as const).map((actor) => [status, action, actor] as const),
    ),
  );

  it.each(cases)('%s + %s by %s', (status, action, actor) => {
    expect(nextRequestStatus(status, action, actor)).toBe(ALLOWED[`${status} ${action} ${actor}`] ?? null);
  });

  it('labels every status in Portuguese and maps roles to actor kinds', () => {
    expect(Object.keys(REQUEST_STATUS_LABELS)).toEqual([...REQUEST_STATUSES]);
    expect(actorKind('CLIENT')).toBe('customer');
    expect(actorKind('EMPLOYEE')).toBe('staff');
  });
});

describe('São Paulo time helpers', () => {
  it('sets the customer cancellation deadline at 18:00 of the previous local day', () => {
    // Visit at 08:00 on 10/10 in São Paulo (11:00 UTC): deadline 18:00 on 09/10 (21:00 UTC).
    expect(customerCancellationDeadline(new Date('2026-10-10T11:00:00Z')).toISOString()).toBe(
      '2026-10-09T21:00:00.000Z',
    );
    // Visit at 01:00 UTC on 11/10 is still 22:00 on 10/10 in São Paulo.
    expect(customerCancellationDeadline(new Date('2026-10-11T01:00:00Z')).toISOString()).toBe(
      '2026-10-09T21:00:00.000Z',
    );
  });

  it('computes local dates', () => {
    expect(saoPauloDate(new Date('2026-10-10T02:00:00Z'))).toBe('2026-10-09');
    expect(saoPauloDate(new Date('2026-10-10T12:00:00Z'), 1)).toBe('2026-10-11');
  });
});
