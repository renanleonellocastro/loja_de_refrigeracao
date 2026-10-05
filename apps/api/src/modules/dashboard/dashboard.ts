import type { AppContext } from '../../context.js';
import { DAY } from '../../shared/clock.js';
import * as agenda from '../agenda/service.js';
import type { AccessClaims } from '../auth/service.js';
import * as catalog from '../catalog/service.js';
import * as repo from './repository.js';

const SAO_PAULO_OFFSET_MS = -3 * 3_600_000;
const LOW_STOCK_LIMIT = 10;
const ORDER_STATUSES: repo.OrderStatus[] = ['PENDING_REVIEW', 'READY_FOR_PICKUP', 'PICKED_UP', 'CANCELED'];
const OPEN_REQUEST_STATUSES: repo.RequestStatus[] = ['REQUESTED', 'AWAITING_CUSTOMER'];

/** Start of the store day and of the store month (São Paulo time) that contain the instant. */
export function storePeriods(now: Date) {
  const local = new Date(now.getTime() + SAO_PAULO_OFFSET_MS);
  const dayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const monthStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1);
  return {
    date: new Date(dayStart).toISOString().slice(0, 10),
    dayStart: new Date(dayStart - SAO_PAULO_OFFSET_MS),
    dayEnd: new Date(dayStart + DAY - SAO_PAULO_OFFSET_MS),
    monthStart: new Date(monthStart - SAO_PAULO_OFFSET_MS),
  };
}

function countsOf<S extends string>(statuses: S[], rows: Array<{ status: S; total: number }>) {
  return Object.fromEntries(
    statuses.map((status) => [status, rows.find((row) => row.status === status)?.total ?? 0]),
  ) as Record<S, number>;
}

type Visit = Awaited<ReturnType<typeof agenda.listAgenda>>[number];

function byTechnician(visits: Visit[]) {
  const groups = new Map<number, { employee: Visit['employee']; appointments: Visit[] }>();
  for (const visit of visits) {
    const group = groups.get(visit.employee.id) ?? { employee: visit.employee, appointments: [] };
    group.appointments.push(visit);
    groups.set(visit.employee.id, group);
  }
  return [...groups.values()].sort((a, b) => a.employee.name.localeCompare(b.employee.name, 'pt-BR'));
}

async function managementView(ctx: AppContext, viewer: AccessClaims, now: Date) {
  const period = storePeriods(now);
  const [orders, requests, quotes, reports, revenue, visits, lowStock] = await Promise.all([
    repo.countOrdersByStatus(ctx.db),
    repo.countRequestsByStatus(ctx.db, OPEN_REQUEST_STATUSES),
    repo.countQuotesAwaitingAnswer(ctx.db),
    repo.countReportsAwaitingApproval(ctx.db),
    repo.approvedServiceRevenue(ctx.db, period.monthStart, now),
    agenda.listAgenda(ctx, viewer, { from: period.dayStart, to: period.dayEnd }),
    catalog.lowStockProducts(ctx.db, LOW_STOCK_LIMIT),
  ]);
  return {
    ordersByStatus: countsOf(ORDER_STATUSES, orders),
    openServiceRequests: countsOf(OPEN_REQUEST_STATUSES, requests),
    quotesAwaitingAnswer: quotes,
    reportsAwaitingApproval: reports,
    serviceRevenueMonthCents: revenue,
    agendaToday: byTechnician(visits),
    lowStock,
  };
}

async function employeeView(ctx: AppContext, viewer: AccessClaims, now: Date) {
  const period = storePeriods(now);
  const [visitsToday, pendingReports] = await Promise.all([
    agenda.listAgenda(ctx, viewer, { from: period.dayStart, to: period.dayEnd }),
    repo.countPendingReports(ctx.db, viewer.userId, period.dayEnd),
  ]);
  return { visitsToday, pendingReports };
}

/** Staff dashboard (RF-38): management indicators for managers, the own day for technicians. */
export async function dashboard(ctx: AppContext, viewer: AccessClaims) {
  const now = ctx.clock.now();
  const isEmployee = viewer.role === 'EMPLOYEE';
  return {
    date: storePeriods(now).date,
    management: isEmployee ? null : await managementView(ctx, viewer, now),
    employee: isEmployee ? await employeeView(ctx, viewer, now) : null,
  };
}
