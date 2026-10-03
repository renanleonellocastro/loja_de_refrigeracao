import type { Role } from '@rc/contracts';

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

/**
 * The service request state machine of docs/DOMINIO.md. Returns the next status,
 * the same status when the action does not change it, or null when it is not allowed.
 */
export function nextRequestStatus(
  current: RequestStatus,
  action: RequestAction,
  actor: ActorKind,
): RequestStatus | null {
  const open = current === 'REQUESTED' || current === 'AWAITING_CUSTOMER';
  switch (action) {
    case 'staffMessage':
      if (actor !== 'staff') return null;
      return current === 'REQUESTED' ? 'AWAITING_CUSTOMER' : isFinal(current) ? null : current;
    case 'customerMessage':
      if (actor !== 'customer') return null;
      return current === 'AWAITING_CUSTOMER' ? 'REQUESTED' : isFinal(current) ? null : current;
    case 'approve':
      return actor === 'staff' && open ? 'APPROVED' : null;
    case 'reject':
      return actor === 'staff' && open ? 'REJECTED' : null;
    case 'schedule':
      return actor === 'staff' && current === 'APPROVED' ? 'SCHEDULED' : null;
    case 'unschedule':
      return actor === 'staff' && current === 'SCHEDULED' ? 'APPROVED' : null;
    case 'submitReport':
      return actor === 'staff' && current === 'SCHEDULED' ? 'AWAITING_COMPLETION_APPROVAL' : null;
    case 'approveReport':
      return actor === 'staff' && current === 'AWAITING_COMPLETION_APPROVAL' ? 'COMPLETED' : null;
    case 'requestRework':
      return actor === 'staff' && current === 'AWAITING_COMPLETION_APPROVAL' ? 'SCHEDULED' : null;
    case 'cancel':
      if (actor === 'customer')
        return open || current === 'APPROVED' || current === 'SCHEDULED' ? 'CANCELED' : null;
      return isFinal(current) || current === 'AWAITING_COMPLETION_APPROVAL' ? null : 'CANCELED';
  }
}

export function isFinal(status: RequestStatus): boolean {
  return status === 'COMPLETED' || status === 'REJECTED' || status === 'CANCELED';
}

/** Brazil has had no daylight saving time since 2019: São Paulo is always UTC-3. */
const SAO_PAULO_OFFSET_HOURS = -3;

/** Customers may cancel a scheduled visit until 18:00 (São Paulo) of the day before. */
export function customerCancellationDeadline(appointmentStart: Date): Date {
  const local = new Date(appointmentStart.getTime() + SAO_PAULO_OFFSET_HOURS * 3_600_000);
  const dayBefore = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - 1, 18);
  return new Date(dayBefore - SAO_PAULO_OFFSET_HOURS * 3_600_000);
}

/** Today's date in São Paulo as YYYY-MM-DD. */
export function saoPauloDate(now: Date, plusDays = 0): string {
  const local = new Date(now.getTime() + SAO_PAULO_OFFSET_HOURS * 3_600_000 + plusDays * 86_400_000);
  return local.toISOString().slice(0, 10);
}
