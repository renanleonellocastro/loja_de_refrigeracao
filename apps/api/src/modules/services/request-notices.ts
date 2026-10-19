import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import * as notifications from '../notifications/service.js';
import * as users from '../users/service.js';
import type { RequestRow } from './repository.js';

const REQUEST_NOTICE_TYPE = 'serviceRequest';

export interface RequestMessage {
  readonly subject: string;
  readonly heading: string;
  readonly paragraphs: string[];
}

export interface ManagementMessage extends RequestMessage {
  readonly requestId: number;
}

/** Where the customer follows a request on the site. */
export const customerRequestPath = (requestId: number) => `/minha-conta/agendamentos/${requestId}`;

export function notifyManagement(
  ctx: AppContext,
  db: Executor,
  exceptUserId: number | null,
  message: ManagementMessage,
) {
  const { requestId, ...notice } = message;
  return notifications.notifyManagement(ctx, db, exceptUserId, {
    ...notice,
    type: REQUEST_NOTICE_TYPE,
    path: `/solicitacoes/${requestId}`,
    actionLabel: 'Abrir solicitação',
  });
}

export function notifyCustomer(ctx: AppContext, db: Executor, request: RequestRow, message: RequestMessage) {
  return notifications.notifyUserById(ctx, db, request.customerId, {
    type: REQUEST_NOTICE_TYPE,
    ...message,
    path: customerRequestPath(request.id),
    actionLabel: 'Ver minha solicitação',
  });
}

/** Tells the technician, when their account still exists, that the visit left their agenda. */
export async function notifyVisitCanceled(
  ctx: AppContext,
  db: Executor,
  employeeId: number,
  requestId: number,
) {
  const employee = await users.findActiveUserById(db, employeeId);
  if (!employee) return;
  await notifications.notifyUser(ctx, db, employee, {
    type: 'appointment',
    subject: `Visita cancelada: solicitação nº ${requestId}`,
    heading: 'Visita cancelada',
    paragraphs: ['Esta visita saiu da sua agenda.'],
  });
}
