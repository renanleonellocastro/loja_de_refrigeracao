import * as services from '../services/service.js';
import type { AppointmentDetails } from './appointment-rules.js';

type ReportRow = NonNullable<AppointmentDetails['report']>;
type Photo = Parameters<typeof services.toPhotoView>[0];

const REMOVED_ACCOUNT_NAME = 'Conta removida';

function customerContact({ customer }: AppointmentDetails) {
  if (customer.deletedAt) return { id: customer.id, name: REMOVED_ACCOUNT_NAME, phone: null };
  return { id: customer.id, name: customer.name, phone: customer.phone };
}

function equipmentView(request: services.RequestRow) {
  const { productKind, brand, model, problem } = request;
  return { productKind, brand, model, problem };
}

function requestView(row: AppointmentDetails) {
  const { request } = row;
  return {
    id: request.id,
    status: request.status,
    statusLabel: services.REQUEST_STATUS_LABELS[request.status],
    serviceType: row.serviceType,
    ...equipmentView(request),
    customer: customerContact(row),
    address: request.address,
  };
}

function findingsView(report: ReportRow) {
  const { defectFound, defectDescription, repairDescription } = report;
  return { defectFound, defectDescription, repairDescription };
}

function reviewView(report: ReportRow) {
  const { amountCents, reworkComment, approvedAt } = report;
  return { amountCents, reworkComment, approvedAt };
}

function reportView(report: ReportRow | null, photos: readonly Photo[]) {
  if (!report) return null;
  return {
    status: report.status,
    ...findingsView(report),
    submittedAt: report.submittedAt,
    ...reviewView(report),
    photos: photos.map(services.toPhotoView),
  };
}

export function toAppointmentView(row: AppointmentDetails, photos: readonly Photo[] = []) {
  const { appointment } = row;
  return {
    id: appointment.id,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    version: appointment.version,
    employee: row.employee,
    request: requestView(row),
    report: reportView(row.report, photos),
  };
}
