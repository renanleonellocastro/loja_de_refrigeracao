import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { conflict, unprocessable } from '../../shared/errors.js';
import { pageOf } from '../../shared/pagination.js';
import type { AccessClaims } from '../auth/service.js';
import { storeImage } from '../media/service.js';
import * as users from '../users/service.js';
import * as repo from './repository.js';
import { canCancel, isManagement, loadVisible } from './request-access.js';
import {
  toMessageView,
  toPhotoView,
  toRequestDetail,
  toRequestListItem,
  type RequestRelations,
} from './request-views.js';
import { isFinal, REQUEST_STATUSES, type RequestStatus } from './status.js';

export const MAX_REQUEST_PHOTOS = 6;

const REQUEST_OWNER_TYPE = 'SERVICE_REQUEST';
const CUSTOMER_EDITABLE_STATUSES: readonly RequestStatus[] = ['REQUESTED', 'AWAITING_CUSTOMER'];

export interface RequestFacetsQuery {
  readonly q?: string | undefined;
}

export interface RequestListQuery extends RequestFacetsQuery {
  readonly status?: RequestStatus[] | undefined;
  readonly page: number;
  readonly pageSize: number;
}

async function loadRelations(db: Executor, request: repo.RequestRow): Promise<RequestRelations> {
  const [serviceType, customer, windows, photos, appointment] = await Promise.all([
    repo.findServiceType(db, request.serviceTypeId),
    users.findActiveUserById(db, request.customerId),
    repo.listWindows(db, request.id),
    repo.listMedia(db, REQUEST_OWNER_TYPE, request.id),
    repo.findAppointmentForRequest(db, request.id),
  ]);
  return { serviceType: serviceType!, customer, windows, photos, appointment };
}

export async function requestDetail(ctx: AppContext, viewer: AccessClaims, id: number) {
  const request = await loadVisible(ctx.db, viewer, id);
  const relations = await loadRelations(ctx.db, request);
  const appointmentStart = relations.appointment?.startsAt ?? null;
  return toRequestDetail(request, relations, canCancel(viewer, request, appointmentStart, ctx.clock.now()));
}

/** Customers see their own requests, technicians the assigned ones; only the staff searches. */
function visibleRequestScope(viewer: AccessClaims, query: RequestFacetsQuery): repo.RequestScope {
  const isCustomer = viewer.role === 'CLIENT';
  return {
    customerId: isCustomer ? viewer.userId : undefined,
    employeeId: viewer.role === 'EMPLOYEE' ? viewer.userId : undefined,
    q: isCustomer ? undefined : query.q,
  };
}

export async function listVisibleRequests(ctx: AppContext, viewer: AccessClaims, query: RequestListQuery) {
  const filters: repo.RequestFilters = {
    ...visibleRequestScope(viewer, query),
    statuses: query.status,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  };
  const { rows, total } = await repo.listRequests(ctx.db, filters);
  return pageOf(rows.map(toRequestListItem), query, total);
}

/** Counts per status of the requests the viewer sees, with every status present and the search applied. */
export async function requestFacets(ctx: AppContext, viewer: AccessClaims, query: RequestFacetsQuery) {
  const rows = await repo.countRequestsByStatus(ctx.db, visibleRequestScope(viewer, query));
  const counted = new Map(rows.map((row) => [row.status, row.count]));
  const statuses = REQUEST_STATUSES.map((status) => ({ status, count: counted.get(status) ?? 0 }));
  return { statuses, total: statuses.reduce((sum, item) => sum + item.count, 0) };
}

/** Customers add photos while the request is open; management until it ends. */
function acceptsPhotosFrom(viewer: AccessClaims, status: RequestStatus): boolean {
  if (viewer.role === 'CLIENT') return CUSTOMER_EDITABLE_STATUSES.includes(status);
  return isManagement(viewer.role) && !isFinal(status);
}

async function assertPhotosAccepted(
  db: Executor,
  viewer: AccessClaims,
  request: repo.RequestRow,
  count: number,
) {
  if (!acceptsPhotosFrom(viewer, request.status)) {
    throw conflict('photos-locked', 'Não é possível enviar fotos', 'Esta solicitação não aceita mais fotos.');
  }
  const existing = await repo.listMedia(db, REQUEST_OWNER_TYPE, request.id);
  if (existing.length + count > MAX_REQUEST_PHOTOS) {
    throw unprocessable(
      'too-many-photos',
      'Fotos demais',
      `Cada solicitação aceita até ${MAX_REQUEST_PHOTOS} fotos.`,
    );
  }
}

async function listRequestPhotos(db: Executor, id: number) {
  return (await repo.listMedia(db, REQUEST_OWNER_TYPE, id)).map(toPhotoView);
}

export async function addPhotos(ctx: AppContext, viewer: AccessClaims, id: number, files: Buffer[]) {
  const request = await loadVisible(ctx.db, viewer, id);
  await assertPhotosAccepted(ctx.db, viewer, request, files.length);
  const stored: Array<{ key: string; width: number; height: number }> = [];
  for (const file of files) stored.push(await storeImage(ctx, file));
  await ctx.db.transaction(async (tx) => {
    for (const image of stored) await repo.insertMedia(tx, REQUEST_OWNER_TYPE, id, image);
  });
  return listRequestPhotos(ctx.db, id);
}

export async function listRequestMessages(ctx: AppContext, viewer: AccessClaims, id: number) {
  await loadVisible(ctx.db, viewer, id);
  const rows = await repo.listMessages(ctx.db, REQUEST_OWNER_TYPE, id);
  return rows.map((message) => toMessageView(message, viewer.userId));
}
