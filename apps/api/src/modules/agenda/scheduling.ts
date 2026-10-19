import type { AppContext } from '../../context.js';
import { MINUTE } from '../../shared/clock.js';
import { assertIfMatch } from '../../shared/concurrency.js';
import { conflict, notFound } from '../../shared/errors.js';
import { formatDateTime } from '../../shared/format.js';
import type { AccessClaims } from '../auth/service.js';
import * as services from '../services/service.js';
import { describeVisit, notifyCustomer, notifyEmployee } from './agenda-notices.js';
import { auditAppointment, type AuditedAgendaStep } from './appointment-audit.js';
import {
  assertEmployee,
  assertFree,
  loadAppointment,
  transitionOrFail,
  validateInterval,
  withOverlapGuard,
  type AppointmentDetails,
  type Interval,
} from './appointment-rules.js';
import * as repo from './repository.js';

export interface ScheduleInput {
  readonly serviceRequestId: number;
  readonly employeeId: number;
  readonly startsAt: Date;
  readonly endsAt?: Date | undefined;
}

export interface RescheduleChanges {
  readonly employeeId?: number | undefined;
  readonly startsAt?: Date | undefined;
  readonly endsAt?: Date | undefined;
}

type Employee = Awaited<ReturnType<typeof assertEmployee>>;

/** A visit just booked, with what its notices tell about it. */
interface BookedVisit {
  readonly request: services.RequestRow;
  readonly employee: Employee;
  readonly serviceType: services.ServiceTypeRow;
  readonly appointment: repo.AppointmentRow;
}

const notScheduled = () =>
  conflict(
    'invalid-transition',
    'Ação indisponível',
    'Só é possível alterar atendimentos ainda não finalizados.',
  );

async function findRequestOrFail(step: AuditedAgendaStep, id: number): Promise<services.RequestRow> {
  const request = await services.findRequest(step.tx, id);
  if (!request) throw notFound('Solicitação não encontrada.');
  return request;
}

/** Without an end time the visit lasts the estimated duration of its service type. */
function visitInterval(input: ScheduleInput, serviceType: services.ServiceTypeRow): Interval {
  const estimatedEnd = new Date(input.startsAt.getTime() + serviceType.estimatedMinutes * MINUTE);
  return { startsAt: input.startsAt, endsAt: input.endsAt ?? estimatedEnd };
}

/** Where and when the technician goes, and the status the request moves to. */
interface Booking {
  readonly status: services.RequestStatus;
  readonly employeeId: number;
  readonly interval: Interval;
}

async function bookVisit(step: AuditedAgendaStep, request: services.RequestRow, booking: Booking) {
  const { status, employeeId, interval } = booking;
  const now = step.ctx.clock.now();
  const appointment = await repo.insertAppointment(step.tx, {
    serviceRequestId: request.id,
    employeeId,
    ...interval,
    createdById: step.actor.userId,
    createdAt: now,
    updatedAt: now,
  });
  await services.updateRequest(step.tx, request.id, { status, updatedAt: now });
  return appointment;
}

function visitAddressLine({ address }: services.RequestRow): string {
  return `${address.street}, ${address.number}, ${address.district}, ${address.city}.`;
}

function confirmVisitToCustomer(step: AuditedAgendaStep, visit: BookedVisit, when: string) {
  return notifyCustomer(step.ctx, step.tx, visit.request, {
    subject: `Visita confirmada: solicitação nº ${visit.request.id}`,
    heading: 'Visita confirmada',
    paragraphs: [
      `Nosso técnico ${visit.employee.name} vai até você em ${when}.`,
      'Se precisar remarcar, fale com a loja até as 18h do dia anterior.',
    ],
  });
}

function assignVisitToEmployee(step: AuditedAgendaStep, visit: BookedVisit, when: string) {
  const { request, employee, serviceType, appointment } = visit;
  return notifyEmployee(step.ctx, step.tx, {
    employeeId: employee.id,
    appointmentId: appointment.id,
    subject: 'Novo atendimento na sua agenda',
    paragraphs: [`${serviceType.name}: ${request.productKind}, ${when}.`, visitAddressLine(request)],
  });
}

async function announceBookedVisit(step: AuditedAgendaStep, visit: BookedVisit) {
  const when = describeVisit(visit.appointment.startsAt, visit.appointment.endsAt);
  await confirmVisitToCustomer(step, visit, when);
  await assignVisitToEmployee(step, visit, when);
}

async function schedule(step: AuditedAgendaStep, input: ScheduleInput) {
  const request = await findRequestOrFail(step, input.serviceRequestId);
  const status = transitionOrFail(request.status, 'schedule');
  const employee = await assertEmployee(step.tx, input.employeeId);
  const serviceType = (await services.findServiceType(step.tx, request.serviceTypeId))!;
  const interval = visitInterval(input, serviceType);
  validateInterval(interval, step.ctx.clock.now());
  await assertFree(step.tx, employee.id, interval);
  const appointment = await bookVisit(step, request, { status, employeeId: employee.id, interval });
  await announceBookedVisit(step, { request, employee, serviceType, appointment });
  await auditAppointment(step, { action: 'appointment.create', id: appointment.id, after: appointment });
  return appointment;
}

/** UC Cadastrar Serviço na Agenda do Colaborador. */
export async function scheduleAppointment(
  ctx: AppContext,
  actor: AccessClaims,
  input: ScheduleInput,
  ip: string,
) {
  return withOverlapGuard(() => ctx.db.transaction((tx) => schedule({ ctx, tx, actor, ip }, input)));
}

/** Moving the start keeps the duration unless a new end is given. */
function rescheduledInterval(before: repo.AppointmentRow, changes: RescheduleChanges): Interval {
  const startsAt = changes.startsAt ?? before.startsAt;
  if (changes.endsAt) return { startsAt, endsAt: changes.endsAt };
  if (!changes.startsAt) return { startsAt, endsAt: before.endsAt };
  const duration = before.endsAt.getTime() - before.startsAt.getTime();
  return { startsAt, endsAt: new Date(startsAt.getTime() + duration) };
}

async function rescheduledEmployeeId(
  step: AuditedAgendaStep,
  before: repo.AppointmentRow,
  changes: RescheduleChanges,
) {
  if (changes.employeeId === undefined) return before.employeeId;
  await assertEmployee(step.tx, changes.employeeId);
  return changes.employeeId;
}

function moveAppointment(
  step: AuditedAgendaStep,
  before: repo.AppointmentRow,
  employeeId: number,
  interval: Interval,
) {
  return repo.updateAppointment(step.tx, before.id, {
    employeeId,
    ...interval,
    version: before.version + 1,
    updatedAt: step.ctx.clock.now(),
  });
}

async function tellPreviousEmployee(
  step: AuditedAgendaStep,
  row: AppointmentDetails,
  after: repo.AppointmentRow,
) {
  const before = row.appointment;
  if (after.employeeId === before.employeeId) return;
  await notifyEmployee(step.ctx, step.tx, {
    employeeId: before.employeeId,
    appointmentId: before.id,
    subject: 'Atendimento saiu da sua agenda',
    paragraphs: [
      `${row.serviceType} de ${formatDateTime(before.startsAt)} foi passado para outro colaborador.`,
    ],
  });
}

function tellCustomerNewDate(step: AuditedAgendaStep, request: services.RequestRow, when: string) {
  return notifyCustomer(step.ctx, step.tx, request, {
    subject: `Visita remarcada: solicitação nº ${request.id}`,
    heading: 'Visita remarcada',
    paragraphs: [`A nova data é ${when}.`],
  });
}

function tellEmployeeNewDate(
  step: AuditedAgendaStep,
  row: AppointmentDetails,
  after: repo.AppointmentRow,
  when: string,
) {
  return notifyEmployee(step.ctx, step.tx, {
    employeeId: after.employeeId,
    appointmentId: after.id,
    subject: 'Atendimento atualizado na sua agenda',
    paragraphs: [`${row.serviceType}: ${when}.`],
  });
}

async function announceRescheduledVisit(
  step: AuditedAgendaStep,
  row: AppointmentDetails,
  after: repo.AppointmentRow,
) {
  const when = describeVisit(after.startsAt, after.endsAt);
  await tellCustomerNewDate(step, row.request, when);
  await tellEmployeeNewDate(step, row, after, when);
  await tellPreviousEmployee(step, row, after);
}

async function reschedule(
  step: AuditedAgendaStep,
  id: number,
  ifMatch: string | undefined,
  changes: RescheduleChanges,
) {
  const row = await loadAppointment(step.tx, step.actor, id);
  const before = row.appointment;
  assertIfMatch(ifMatch, before.version);
  if (row.request.status !== 'SCHEDULED') throw notScheduled();
  const employeeId = await rescheduledEmployeeId(step, before, changes);
  const interval = rescheduledInterval(before, changes);
  validateInterval(interval, step.ctx.clock.now());
  await assertFree(step.tx, employeeId, interval, id);
  const after = await moveAppointment(step, before, employeeId, interval);
  await announceRescheduledVisit(step, row, after);
  await auditAppointment(step, { action: 'appointment.update', id, before, after });
  return after;
}

/** UC Alterar Serviço na Agenda: requires If-Match with the current version. */
export async function rescheduleAppointment(
  ctx: AppContext,
  actor: AccessClaims,
  id: number,
  ifMatch: string | undefined,
  changes: RescheduleChanges,
  ip: string,
) {
  return withOverlapGuard(() =>
    ctx.db.transaction((tx) => reschedule({ ctx, tx, actor, ip }, id, ifMatch, changes)),
  );
}

async function announceUnscheduledVisit(step: AuditedAgendaStep, row: AppointmentDetails) {
  await notifyCustomer(step.ctx, step.tx, row.request, {
    subject: `Visita desmarcada: solicitação nº ${row.request.id}`,
    heading: 'Vamos remarcar sua visita',
    paragraphs: ['A visita marcada foi desmarcada. A loja vai combinar uma nova data com você.'],
  });
  await notifyEmployee(step.ctx, step.tx, {
    employeeId: row.appointment.employeeId,
    appointmentId: row.appointment.id,
    subject: 'Atendimento removido da sua agenda',
    paragraphs: [`${row.serviceType} de ${formatDateTime(row.appointment.startsAt)} foi removido.`],
  });
}

async function unschedule(step: AuditedAgendaStep, id: number): Promise<void> {
  const row = await loadAppointment(step.tx, step.actor, id);
  const status = transitionOrFail(row.request.status, 'unschedule');
  await repo.deleteAppointment(step.tx, id);
  await services.updateRequest(step.tx, row.request.id, { status, updatedAt: step.ctx.clock.now() });
  await announceUnscheduledVisit(step, row);
  await auditAppointment(step, { action: 'appointment.delete', id, before: row.appointment });
}

/** UC Excluir Serviço da Agenda (super user): the request goes back to approved, waiting for a new date. */
export async function removeAppointment(ctx: AppContext, actor: AccessClaims, id: number, ip: string) {
  await ctx.db.transaction((tx) => unschedule({ ctx, tx, actor, ip }, id));
}
