import { imageView } from '../media/service.js';
import type * as repo from './repository.js';
import { REQUEST_STATUS_LABELS, type RequestStatus } from './status.js';

type MediaRow = Awaited<ReturnType<typeof repo.listMedia>>[number];
type MessageRow = Awaited<ReturnType<typeof repo.listMessages>>[number];
type ListRow = Awaited<ReturnType<typeof repo.listRequests>>['rows'][number];
type AppointmentSummary = NonNullable<Awaited<ReturnType<typeof repo.findAppointmentForRequest>>>;

interface Contact {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
}

/** Everything a request detail shows besides the request row itself. */
export interface RequestRelations {
  readonly serviceType: repo.ServiceTypeRow;
  readonly customer: Contact | undefined;
  readonly windows: Awaited<ReturnType<typeof repo.listWindows>>;
  readonly photos: MediaRow[];
  readonly appointment: AppointmentSummary | undefined;
}

const REMOVED_ACCOUNT_NAME = 'Conta removida';

export function toPhotoView(photo: Pick<MediaRow, 'id' | 'storageKey' | 'width' | 'height'>) {
  return { id: photo.id, ...imageView({ key: photo.storageKey, width: photo.width, height: photo.height }) };
}

interface Tracked {
  readonly id: number;
  readonly status: RequestStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function headerView({ id, status }: Tracked) {
  return { id, status, statusLabel: REQUEST_STATUS_LABELS[status] };
}

function timestampsView({ createdAt, updatedAt }: Tracked) {
  return { createdAt, updatedAt };
}

function toCustomerContact(customerId: number, customer: Contact | undefined): Contact {
  if (!customer) return { id: customerId, name: REMOVED_ACCOUNT_NAME, email: '', phone: null };
  return { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone };
}

function toAppointmentView(appointment: AppointmentSummary | undefined) {
  if (!appointment) return null;
  const { id, employeeId, employeeName, startsAt, endsAt } = appointment;
  return { id, employee: { id: employeeId, name: employeeName }, startsAt, endsAt };
}

function equipmentView(request: repo.RequestRow) {
  const { productKind, brand, model, problem, address } = request;
  return { productKind, brand, model, problem, address };
}

function outcomeView(request: repo.RequestRow) {
  const { quoteId, rejectionReason, cancellationReason } = request;
  return { quoteId, rejectionReason, cancellationReason };
}

export function toRequestDetail(request: repo.RequestRow, relations: RequestRelations, canCancel: boolean) {
  return {
    ...headerView(request),
    serviceType: { id: relations.serviceType.id, name: relations.serviceType.name },
    ...equipmentView(request),
    windows: relations.windows,
    photos: relations.photos.map(toPhotoView),
    customer: toCustomerContact(request.customerId, relations.customer),
    appointment: toAppointmentView(relations.appointment),
    ...outcomeView(request),
    canCancel,
    ...timestampsView(request),
  };
}

function toAssignedEmployee(row: ListRow) {
  if (row.employeeId === null || row.employeeName === null) return null;
  return { id: row.employeeId, name: row.employeeName };
}

export function toRequestListItem(row: ListRow) {
  return {
    ...headerView(row),
    serviceType: row.serviceType,
    productKind: row.productKind,
    customer: { id: row.customerId, name: row.customerName },
    scheduledFor: row.scheduledFor,
    employee: toAssignedEmployee(row),
    ...timestampsView(row),
  };
}

export function toMessageView(message: MessageRow, viewerId: number) {
  return {
    id: message.id,
    body: message.body,
    author: { id: message.authorId, name: message.authorName, role: message.authorRole },
    mine: message.authorId === viewerId,
    createdAt: message.createdAt,
  };
}
