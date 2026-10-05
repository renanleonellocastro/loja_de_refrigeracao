import { and, count, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import type { Executor } from '../../infra/db/client.js';
import { appointments, orders, quotes, serviceReports, serviceRequests } from '../../infra/db/schema.js';

export type OrderStatus = (typeof orders.$inferSelect)['status'];
export type RequestStatus = (typeof serviceRequests.$inferSelect)['status'];

export async function countOrdersByStatus(db: Executor) {
  return db.select({ status: orders.status, total: count() }).from(orders).groupBy(orders.status);
}

export async function countRequestsByStatus(db: Executor, statuses: RequestStatus[]) {
  return db
    .select({ status: serviceRequests.status, total: count() })
    .from(serviceRequests)
    .where(inArray(serviceRequests.status, statuses))
    .groupBy(serviceRequests.status);
}

export async function countQuotesAwaitingAnswer(db: Executor): Promise<number> {
  const [row] = await db.select({ total: count() }).from(quotes).where(eq(quotes.status, 'REQUESTED'));
  return row!.total;
}

export async function countReportsAwaitingApproval(db: Executor): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(serviceReports)
    .where(eq(serviceReports.status, 'SUBMITTED'));
  return row!.total;
}

/** Sum of the approved service reports in [from, to), in cents. */
export async function approvedServiceRevenue(db: Executor, from: Date, to: Date): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${serviceReports.amountCents}), 0)`.mapWith(Number) })
    .from(serviceReports)
    .where(
      and(
        eq(serviceReports.status, 'APPROVED'),
        gte(serviceReports.approvedAt, from),
        lt(serviceReports.approvedAt, to),
      ),
    );
  return row!.total;
}

/** Visits of the technician that started before `until` and still wait for the completion report. */
export async function countPendingReports(db: Executor, employeeId: number, until: Date): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(appointments)
    .innerJoin(serviceRequests, eq(serviceRequests.id, appointments.serviceRequestId))
    .where(
      and(
        eq(appointments.employeeId, employeeId),
        lt(appointments.startsAt, until),
        eq(serviceRequests.status, 'SCHEDULED'),
      ),
    );
  return row!.total;
}
