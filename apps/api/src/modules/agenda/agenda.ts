import type { AppContext } from '../../context.js';
import type { AccessClaims } from '../auth/service.js';
import * as services from '../services/service.js';
import { loadAppointment } from './appointment-rules.js';
import { toAppointmentView } from './appointment-view.js';
import * as repo from './repository.js';

export interface AgendaQuery {
  readonly from: Date;
  readonly to: Date;
  readonly employeeId?: number | undefined;
}

type BusyInterval = Awaited<ReturnType<typeof repo.busyIntervals>>[number];

export async function getAppointment(ctx: AppContext, viewer: AccessClaims, id: number) {
  const row = await loadAppointment(ctx.db, viewer, id);
  const photos = row.report ? await services.listMedia(ctx.db, 'SERVICE_REPORT', row.report.id) : [];
  return toAppointmentView(row, photos);
}

/** Agenda in a time range: the technician sees their own, management sees everyone (or one technician). */
export async function listAgenda(ctx: AppContext, viewer: AccessClaims, query: AgendaQuery) {
  const employeeId = viewer.role === 'EMPLOYEE' ? viewer.userId : query.employeeId;
  const rows = await repo.listAppointmentsInRange(ctx.db, query.from, query.to, employeeId);
  return rows.map((row) => toAppointmentView(row));
}

function busyIntervalsOf(employeeId: number, busy: readonly BusyInterval[]) {
  return busy
    .filter((interval) => interval.employeeId === employeeId)
    .map((interval) => ({
      appointmentId: interval.id,
      startsAt: interval.startsAt,
      endsAt: interval.endsAt,
    }));
}

export async function availability(ctx: AppContext, from: Date, to: Date) {
  const employees = await repo.activeEmployees(ctx.db);
  const employeeIds = employees.map((employee) => employee.id);
  const busy = await repo.busyIntervals(ctx.db, employeeIds, from, to);
  return employees.map((employee) => ({ employee, busy: busyIntervalsOf(employee.id, busy) }));
}
