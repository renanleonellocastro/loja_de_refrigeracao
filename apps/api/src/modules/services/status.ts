import type { Role } from '@rc/contracts';
import { DAY, HOUR } from '../../shared/clock.js';

export const REQUEST_STATUSES = [
  'REQUESTED',
  'AWAITING_CUSTOMER',
  'APPROVED',
  'SCHEDULED',
  'AWAITING_COMPLETION_APPROVAL',
  'COMPLETED',
  'REJECTED',
  'CANCELED',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  REQUESTED: 'Solicitado',
  AWAITING_CUSTOMER: 'Aguardando sua resposta',
  APPROVED: 'Aprovado',
  SCHEDULED: 'Agendado',
  AWAITING_COMPLETION_APPROVAL: 'Aguardando aprovação da finalização',
  COMPLETED: 'Concluído',
  REJECTED: 'Recusado',
  CANCELED: 'Cancelado',
};

export type RequestAction =
  | 'staffMessage'
  | 'customerMessage'
  | 'approve'
  | 'reject'
  | 'schedule'
  | 'unschedule'
  | 'submitReport'
  | 'approveReport'
  | 'requestRework'
  | 'cancel';

export type ActorKind = 'customer' | 'staff';

export function actorKind(role: Role): ActorKind {
  return role === 'CLIENT' ? 'customer' : 'staff';
}

type Transition = (current: RequestStatus) => RequestStatus | null;

const OPEN_STATUSES: readonly RequestStatus[] = ['REQUESTED', 'AWAITING_CUSTOMER'];
const FINAL_STATUSES: readonly RequestStatus[] = ['COMPLETED', 'REJECTED', 'CANCELED'];
const CANCELABLE_STATUSES: readonly RequestStatus[] = [...OPEN_STATUSES, 'APPROVED', 'SCHEDULED'];

function moveFrom(sources: readonly RequestStatus[], target: RequestStatus): Transition {
  return (current) => (sources.includes(current) ? target : null);
}

/** A message answers the side that was waiting and leaves any other open status as it is. */
function answerWaiting(waiting: RequestStatus, answered: RequestStatus): Transition {
  return (current) => {
    if (current === waiting) return answered;
    return isFinal(current) ? null : current;
  };
}

/** The service request state machine of docs/DOMINIO.md, by action and by who acts. */
const TRANSITIONS: Readonly<Record<RequestAction, Partial<Record<ActorKind, Transition>>>> = {
  staffMessage: { staff: answerWaiting('REQUESTED', 'AWAITING_CUSTOMER') },
  customerMessage: { customer: answerWaiting('AWAITING_CUSTOMER', 'REQUESTED') },
  approve: { staff: moveFrom(OPEN_STATUSES, 'APPROVED') },
  reject: { staff: moveFrom(OPEN_STATUSES, 'REJECTED') },
  schedule: { staff: moveFrom(['APPROVED'], 'SCHEDULED') },
  unschedule: { staff: moveFrom(['SCHEDULED'], 'APPROVED') },
  submitReport: { staff: moveFrom(['SCHEDULED'], 'AWAITING_COMPLETION_APPROVAL') },
  approveReport: { staff: moveFrom(['AWAITING_COMPLETION_APPROVAL'], 'COMPLETED') },
  requestRework: { staff: moveFrom(['AWAITING_COMPLETION_APPROVAL'], 'SCHEDULED') },
  cancel: {
    customer: moveFrom(CANCELABLE_STATUSES, 'CANCELED'),
    staff: moveFrom(CANCELABLE_STATUSES, 'CANCELED'),
  },
};

/**
 * Returns the next status, the same status when the action does not change it,
 * or null when it is not allowed.
 */
export function nextRequestStatus(
  current: RequestStatus,
  action: RequestAction,
  actor: ActorKind,
): RequestStatus | null {
  const transition = TRANSITIONS[action][actor];
  return transition ? transition(current) : null;
}

export function isFinal(status: RequestStatus): boolean {
  return FINAL_STATUSES.includes(status);
}

/** Brazil has had no daylight saving time since 2019: São Paulo is always UTC-3. */
const SAO_PAULO_OFFSET_HOURS = -3;

const CANCELLATION_DEADLINE_HOUR = 18;
const ISO_DATE_LENGTH = 10;

/** Customers may cancel a scheduled visit until 18:00 (São Paulo) of the day before. */
export function customerCancellationDeadline(appointmentStart: Date): Date {
  const local = new Date(appointmentStart.getTime() + SAO_PAULO_OFFSET_HOURS * HOUR);
  const dayBefore = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - 1,
    CANCELLATION_DEADLINE_HOUR,
  );
  return new Date(dayBefore - SAO_PAULO_OFFSET_HOURS * HOUR);
}

/** Today's date in São Paulo as YYYY-MM-DD. */
export function saoPauloDate(now: Date, plusDays = 0): string {
  const local = new Date(now.getTime() + SAO_PAULO_OFFSET_HOURS * HOUR + plusDays * DAY);
  return local.toISOString().slice(0, ISO_DATE_LENGTH);
}
