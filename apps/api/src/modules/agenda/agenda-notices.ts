import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { formatDateTime, formatTimeRange } from '../../shared/format.js';
import * as notifications from '../notifications/service.js';
import type * as services from '../services/service.js';

const APPOINTMENT_NOTICE_TYPE = 'appointment';

export interface CustomerMessage {
  readonly subject: string;
  readonly heading: string;
  readonly paragraphs: string[];
}

export interface EmployeeMessage {
  readonly employeeId: number;
  readonly appointmentId: number;
  readonly subject: string;
  readonly paragraphs: string[];
}

/** "terça-feira, 07/10, 09:00 (09:00 às 11:00)": the visit as customers and technicians read it. */
export function describeVisit(startsAt: Date, endsAt: Date): string {
  return `${formatDateTime(startsAt)} (${formatTimeRange(startsAt, endsAt)})`;
}

export function notifyCustomer(
  ctx: AppContext,
  db: Executor,
  request: services.RequestRow,
  message: CustomerMessage,
) {
  return notifications.notifyUserById(ctx, db, request.customerId, {
    type: APPOINTMENT_NOTICE_TYPE,
    ...message,
    path: `/minha-conta/agendamentos/${request.id}`,
    actionLabel: 'Ver meu agendamento',
  });
}

export function notifyEmployee(ctx: AppContext, db: Executor, message: EmployeeMessage) {
  const { employeeId, appointmentId, subject, paragraphs } = message;
  return notifications.notifyUserById(ctx, db, employeeId, {
    type: APPOINTMENT_NOTICE_TYPE,
    subject,
    paragraphs,
    path: `/agenda/${appointmentId}`,
    actionLabel: 'Abrir na agenda',
  });
}

/** Management approves finished services from the approval page of the appointment. */
export function notifyManagementOfReport(
  ctx: AppContext,
  db: Executor,
  appointmentId: number,
  message: { subject: string; paragraphs: string[] },
) {
  return notifications.notifyManagement(ctx, db, null, {
    type: 'serviceReport',
    ...message,
    path: `/aprovacoes/${appointmentId}`,
    actionLabel: 'Abrir aprovação',
  });
}
