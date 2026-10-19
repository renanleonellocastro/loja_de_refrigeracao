import type { Role } from '@rc/contracts';
import type { Executor } from '../../infra/db/client.js';
import { notFound } from '../../shared/errors.js';
import type { AccessClaims } from '../auth/service.js';
import * as repo from './repository.js';
import { actorKind, customerCancellationDeadline, nextRequestStatus } from './status.js';

const MANAGEMENT_ROLES: readonly Role[] = ['MANAGER', 'ADMIN'];

export const isManagement = (role: Role) => MANAGEMENT_ROLES.includes(role);

const requestNotFound = () => notFound('Solicitação não encontrada.');

async function isAssignedTo(db: Executor, requestId: number, employeeId: number): Promise<boolean> {
  const appointment = await repo.findAppointmentForRequest(db, requestId);
  return appointment?.employeeId === employeeId;
}

type VisibilityRule = (
  db: Executor,
  viewer: AccessClaims,
  request: repo.RequestRow,
) => boolean | Promise<boolean>;

const seesEveryRequest: VisibilityRule = () => true;

/** Who sees a request, by role: management all, the customer their own, a technician the assigned ones. */
const VISIBILITY_BY_ROLE: Readonly<Record<Role, VisibilityRule>> = {
  ADMIN: seesEveryRequest,
  MANAGER: seesEveryRequest,
  CLIENT: (_db, viewer, request) => request.customerId === viewer.userId,
  EMPLOYEE: (db, viewer, request) => isAssignedTo(db, request.id, viewer.userId),
};

/** Loads a request the viewer may see: their own (customer), assigned to them (employee) or any (management). */
export async function loadVisible(db: Executor, viewer: AccessClaims, id: number): Promise<repo.RequestRow> {
  const request = await repo.findRequest(db, id);
  if (!request || !(await VISIBILITY_BY_ROLE[viewer.role](db, viewer, request))) throw requestNotFound();
  return request;
}

/** Customers cancel until the deadline before the visit; employees never cancel through the site. */
export function canCancel(
  viewer: AccessClaims,
  request: repo.RequestRow,
  appointmentStart: Date | null,
  now: Date,
) {
  if (viewer.role === 'EMPLOYEE') return false;
  const kind = actorKind(viewer.role);
  if (nextRequestStatus(request.status, 'cancel', kind) === null) return false;
  if (kind === 'customer' && appointmentStart) return now < customerCancellationDeadline(appointmentStart);
  return true;
}
