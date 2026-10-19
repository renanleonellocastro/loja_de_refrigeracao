import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { recordAudit } from '../audit/service.js';
import type { AccessClaims } from '../auth/service.js';

/** Who changes the agenda and inside which transaction. */
export interface AgendaStep {
  readonly ctx: AppContext;
  readonly tx: Executor;
  readonly actor: AccessClaims;
}

/** A change the audit trail records, so it also knows where the request came from. */
export interface AuditedAgendaStep extends AgendaStep {
  readonly ip: string;
}

export interface AppointmentAuditEntry {
  readonly action: string;
  readonly id: number;
  readonly before?: unknown;
  readonly after?: unknown;
}

export function auditAppointment(
  step: AuditedAgendaStep,
  { action, id, before, after }: AppointmentAuditEntry,
) {
  return recordAudit(step.tx, {
    actorId: step.actor.userId,
    action,
    resourceType: 'appointment',
    resourceId: id,
    before,
    after,
    ip: step.ip,
  });
}
