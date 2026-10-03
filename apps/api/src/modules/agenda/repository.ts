import { and, asc, eq, gt, inArray, isNull, lt, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Executor } from '../../infra/db/client.js';
import { appointments, serviceReports, serviceRequests, serviceTypes, users } from '../../infra/db/schema.js';

export type AppointmentRow = typeof appointments.$inferSelect;
export type ReportRow = typeof serviceReports.$inferSelect;

const employee = alias(users, 'employee');
const customer = alias(users, 'customer');

function selectAppointments(db: Executor) {
  return db
    .select({
      appointment: appointments,
      employee: { id: employee.id, name: employee.name },
      request: serviceRequests,
      serviceType: serviceTypes.name,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        deletedAt: customer.deletedAt,
      },
      report: serviceReports,
    })
    .from(appointments)
    .innerJoin(employee, eq(employee.id, appointments.employeeId))
    .innerJoin(serviceRequests, eq(serviceRequests.id, appointments.serviceRequestId))
    .innerJoin(serviceTypes, eq(serviceTypes.id, serviceRequests.serviceTypeId))
    .innerJoin(customer, eq(customer.id, serviceRequests.customerId))
    .leftJoin(serviceReports, eq(serviceReports.appointmentId, appointments.id));
}

export type AppointmentJoin = Awaited<ReturnType<typeof findAppointmentJoin>>;

export async function findAppointmentJoin(db: Executor, id: number) {
  const [row] = await selectAppointments(db).where(eq(appointments.id, id)).limit(1);
  return row;
}

export async function listAppointmentsInRange(db: Executor, from: Date, to: Date, employeeId?: number) {
  const conditions = [lt(appointments.startsAt, to), gt(appointments.endsAt, from)];
  if (employeeId !== undefined) conditions.push(eq(appointments.employeeId, employeeId));
  return selectAppointments(db)
    .where(and(...conditions))
    .orderBy(asc(appointments.startsAt), asc(appointments.id));
}

/** Appointments of the technician overlapping the interval, other than `exceptId`. */
export async function findOverlap(
  db: Executor,
  employeeId: number,
  startsAt: Date,
  endsAt: Date,
  exceptId?: number,
) {
  const conditions = [
    eq(appointments.employeeId, employeeId),
    lt(appointments.startsAt, endsAt),
    gt(appointments.endsAt, startsAt),
  ];
  if (exceptId !== undefined) conditions.push(ne(appointments.id, exceptId));
  const [row] = await db
    .select()
    .from(appointments)
    .where(and(...conditions))
    .limit(1);
  return row;
}

export async function insertAppointment(
  db: Executor,
  values: typeof appointments.$inferInsert,
): Promise<AppointmentRow> {
  const [row] = await db.insert(appointments).values(values).returning();
  return row!;
}

export async function updateAppointment(
  db: Executor,
  id: number,
  values: Partial<typeof appointments.$inferInsert>,
) {
  const [row] = await db.update(appointments).set(values).where(eq(appointments.id, id)).returning();
  return row!;
}

export async function deleteAppointment(db: Executor, id: number): Promise<void> {
  await db.delete(appointments).where(eq(appointments.id, id));
}

export async function activeEmployees(db: Executor) {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.role, 'EMPLOYEE'), isNull(users.deletedAt)))
    .orderBy(asc(users.name));
}

export async function busyIntervals(db: Executor, employeeIds: number[], from: Date, to: Date) {
  if (employeeIds.length === 0) return [];
  return db
    .select({
      id: appointments.id,
      employeeId: appointments.employeeId,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
    })
    .from(appointments)
    .where(
      and(
        inArray(appointments.employeeId, employeeIds),
        lt(appointments.startsAt, to),
        gt(appointments.endsAt, from),
      ),
    )
    .orderBy(asc(appointments.startsAt));
}

export async function saveReport(
  db: Executor,
  appointmentId: number,
  values: {
    defectFound: boolean;
    defectDescription: string | null;
    repairDescription: string;
    submittedAt: Date;
  },
): Promise<ReportRow> {
  const [row] = await db
    .insert(serviceReports)
    .values({ appointmentId, status: 'SUBMITTED', ...values })
    .onConflictDoUpdate({
      target: serviceReports.appointmentId,
      set: { status: 'SUBMITTED', reworkComment: null, ...values },
    })
    .returning();
  return row!;
}

export async function updateReport(
  db: Executor,
  appointmentId: number,
  values: Partial<typeof serviceReports.$inferInsert>,
) {
  const [row] = await db
    .update(serviceReports)
    .set(values)
    .where(eq(serviceReports.appointmentId, appointmentId))
    .returning();
  return row!;
}
