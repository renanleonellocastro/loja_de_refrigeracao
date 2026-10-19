import { can, type Role } from '@rc/contracts';
import type { AppContext } from '../../context.js';
import { orderNumber } from '../orders/service.js';
import { RECENT_ACTIVITY_LIMIT } from './schemas.js';
import * as users from './service.js';

type CustomerActivity = Awaited<ReturnType<typeof users.recentCustomerActivity>>;
type RecentOrder = CustomerActivity['orders'][number];

interface RecentActivity {
  readonly recentOrders: Array<RecentOrder & { number: string }>;
  readonly recentServiceRequests: CustomerActivity['serviceRequests'];
  readonly recentAppointments: Awaited<ReturnType<typeof users.recentEmployeeAppointments>>;
}

type RecentActivityLoader = (ctx: AppContext, actorRole: Role, userId: number) => Promise<RecentActivity>;

const noActivity = (): RecentActivity => ({
  recentOrders: [],
  recentServiceRequests: [],
  recentAppointments: [],
});

const withOrderNumber = (order: RecentOrder) => ({ ...order, number: orderNumber(order.id) });

async function employeeActivity(ctx: AppContext, _actorRole: Role, userId: number): Promise<RecentActivity> {
  const appointments = await users.recentEmployeeAppointments(ctx.db, userId, RECENT_ACTIVITY_LIMIT);
  return { ...noActivity(), recentAppointments: appointments };
}

async function customerActivity(ctx: AppContext, actorRole: Role, userId: number): Promise<RecentActivity> {
  const activity = await users.recentCustomerActivity(ctx.db, userId, RECENT_ACTIVITY_LIMIT);
  return {
    ...noActivity(),
    recentOrders: can(actorRole, 'orders.manage') ? activity.orders.map(withOrderNumber) : [],
    recentServiceRequests: can(actorRole, 'serviceRequests.manage') ? activity.serviceRequests : [],
  };
}

/** Roles without a loader (managers and the super user) have no history on their detail. */
const ACTIVITY_BY_ROLE: Partial<Record<Role, RecentActivityLoader>> = {
  EMPLOYEE: employeeActivity,
  CLIENT: customerActivity,
};

/** Recent history shown on the user detail; each list only when the actor may open its records. */
export async function recentActivity(ctx: AppContext, actorRole: Role, user: users.UserRow) {
  const load = ACTIVITY_BY_ROLE[user.role];
  return load ? load(ctx, actorRole, user.id) : noActivity();
}
