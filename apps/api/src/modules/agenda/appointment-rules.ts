import type { Executor } from '../../infra/db/client.js';
import { HOUR, MINUTE } from '../../shared/clock.js';
import { conflict, notFound, unprocessable } from '../../shared/errors.js';
import { formatTimeRange } from '../../shared/format.js';
import type { AccessClaims } from '../auth/service.js';
import * as services from '../services/service.js';
import * as users from '../users/service.js';
import * as repo from './repository.js';

export type AppointmentDetails = NonNullable<repo.AppointmentJoin>;

export interface Interval {
  readonly startsAt: Date;
  readonly endsAt: Date;
}

const MAX_DURATION = 12 * HOUR;
const PAST_TOLERANCE = 5 * MINUTE;
const EXCLUSION_VIOLATION = '23P01';

const invalidTime = (path: string, message: string) =>
  unprocessable('invalid-time', 'Horário inválido', message, { errors: [{ path, message }] });

/** Loads an appointment the viewer may see: a technician only their own, management any. */
export async function loadAppointment(
  db: Executor,
  viewer: AccessClaims,
  id: number,
): Promise<AppointmentDetails> {
  const row = await repo.findAppointmentJoin(db, id);
  if (!row || (viewer.role === 'EMPLOYEE' && row.appointment.employeeId !== viewer.userId)) {
    throw notFound('Agendamento não encontrado.');
  }
  return row;
}

export function validateInterval({ startsAt, endsAt }: Interval, now: Date) {
  if (startsAt.getTime() < now.getTime() - PAST_TOLERANCE)
    throw invalidTime('startsAt', 'Escolha um horário futuro.');
  if (endsAt <= startsAt) throw invalidTime('endsAt', 'O fim deve ser depois do início.');
  if (endsAt.getTime() - startsAt.getTime() > MAX_DURATION) {
    throw invalidTime('endsAt', 'Um atendimento dura no máximo 12 horas.');
  }
}

export async function assertEmployee(db: Executor, employeeId: number) {
  const employee = await users.findActiveUserById(db, employeeId);
  if (!employee || employee.role !== 'EMPLOYEE') {
    throw unprocessable('invalid-employee', 'Colaborador inválido', 'Escolha um colaborador ativo.', {
      errors: [{ path: 'employeeId', message: 'Escolha um colaborador ativo.' }],
    });
  }
  return employee;
}

/** Fails when the technician already has another appointment overlapping the interval. */
export async function assertFree(db: Executor, employeeId: number, interval: Interval, exceptId?: number) {
  const overlap = await repo.findOverlap(db, employeeId, interval.startsAt, interval.endsAt, exceptId);
  if (!overlap) return;
  throw conflict(
    'schedule-conflict',
    'Horário ocupado',
    `O colaborador já tem um atendimento das ${formatTimeRange(overlap.startsAt, overlap.endsAt)}.`,
    { conflictingAppointmentId: overlap.id },
  );
}

/** The overlap check runs first for a clear message; the database constraint still guards concurrent writes. */
export function mapOverlapViolation(error: unknown): never {
  const code =
    (error as { code?: string; cause?: { code?: string } }).cause?.code ?? (error as { code?: string }).code;
  if (code === EXCLUSION_VIOLATION) {
    throw conflict(
      'schedule-conflict',
      'Horário ocupado',
      'Outra pessoa acabou de agendar este horário. Escolha outro.',
    );
  }
  throw error;
}

export function transitionOrFail(status: services.RequestStatus, action: services.RequestAction) {
  const next = services.nextRequestStatus(status, action, 'staff');
  if (next === null) {
    throw conflict(
      'invalid-transition',
      'Ação indisponível',
      `A solicitação está ${services.REQUEST_STATUS_LABELS[status].toLowerCase()}.`,
    );
  }
  return next;
}

/** Runs a write that may race another booking of the same technician. */
export async function withOverlapGuard<Result>(write: () => Promise<Result>): Promise<Result> {
  try {
    return await write();
  } catch (error) {
    return mapOverlapViolation(error);
  }
}
