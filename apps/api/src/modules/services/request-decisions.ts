import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { conflict, forbidden } from '../../shared/errors.js';
import { recordAudit } from '../audit/service.js';
import type { AccessClaims } from '../auth/service.js';
import * as repo from './repository.js';
import { loadVisible } from './request-access.js';
import { notifyCustomer, notifyManagement, notifyVisitCanceled } from './request-notices.js';
import {
  REQUEST_STATUS_LABELS,
  actorKind,
  customerCancellationDeadline,
  nextRequestStatus,
  type ActorKind,
  type RequestAction,
  type RequestStatus,
} from './status.js';

/** Who acts on a request and inside which transaction. */
interface RequestStep {
  readonly ctx: AppContext;
  readonly tx: Executor;
  readonly viewer: AccessClaims;
}

/** A step the audit trail records, so it also knows where the action came from. */
interface AuditedStep extends RequestStep {
  readonly ip: string;
}

type Appointment = Awaited<ReturnType<typeof repo.findAppointmentForRequest>>;

/** How a message moves the request and whom it tells, by who writes it. */
interface MessageFlow {
  readonly action: RequestAction;
  announce(step: RequestStep, request: repo.RequestRow, body: string): Promise<void>;
}

/** What a cancellation checks first and whom it tells afterwards, by who cancels. */
interface CancellationFlow {
  assertAllowed(step: AuditedStep, appointment: Appointment): void;
  announce(step: AuditedStep, request: repo.RequestRow, reason: string | undefined): Promise<void>;
}

const invalidTransition = (status: RequestStatus) =>
  conflict(
    'invalid-transition',
    'Ação indisponível',
    `Não é possível fazer isso com uma solicitação ${REQUEST_STATUS_LABELS[status].toLowerCase()}.`,
  );

const cancellationDeadlinePassed = () =>
  conflict(
    'cancellation-deadline-passed',
    'Prazo de cancelamento encerrado',
    'A visita só pode ser cancelada pelo site até as 18h do dia anterior. Ligue para a loja.',
  );

async function transition(
  step: RequestStep,
  request: repo.RequestRow,
  action: RequestAction,
  extra: Partial<repo.RequestRow> = {},
) {
  const next = nextRequestStatus(request.status, action, actorKind(step.viewer.role));
  if (next === null) throw invalidTransition(request.status);
  return repo.updateRequest(step.tx, request.id, { status: next, updatedAt: step.ctx.clock.now(), ...extra });
}

function auditRequest(step: AuditedStep, action: string, requestId: number) {
  return recordAudit(step.tx, {
    actorId: step.viewer.userId,
    action,
    resourceType: 'serviceRequest',
    resourceId: requestId,
    ip: step.ip,
  });
}

function insertMessage(step: RequestStep, requestId: number, body: string) {
  return repo.insertMessage(
    step.tx,
    'SERVICE_REQUEST',
    requestId,
    step.viewer.userId,
    body,
    step.ctx.clock.now(),
  );
}

async function announceCustomerReply(step: RequestStep, request: repo.RequestRow, body: string) {
  await notifyManagement(step.ctx, step.tx, null, {
    subject: `Resposta do cliente na solicitação nº ${request.id}`,
    heading: 'O cliente respondeu',
    paragraphs: [body],
    requestId: request.id,
  });
}

async function announceStoreMessage(step: RequestStep, request: repo.RequestRow, body: string) {
  await notifyCustomer(step.ctx, step.tx, request, {
    subject: `Mensagem sobre sua solicitação nº ${request.id}`,
    heading: 'A loja enviou uma mensagem',
    paragraphs: [body, 'Responda pelo site para a gente seguir com o seu atendimento.'],
  });
}

/** A store question waits for the customer's answer; the answer gives the turn back to the store. */
const MESSAGE_FLOWS: Readonly<Record<ActorKind, MessageFlow>> = {
  customer: { action: 'customerMessage', announce: announceCustomerReply },
  staff: { action: 'staffMessage', announce: announceStoreMessage },
};

async function addConversationMessage(step: RequestStep, id: number, body: string): Promise<void> {
  const request = await loadVisible(step.tx, step.viewer, id);
  const flow = MESSAGE_FLOWS[actorKind(step.viewer.role)];
  await transition(step, request, flow.action);
  await insertMessage(step, id, body);
  await flow.announce(step, request, body);
}

/** Conversation between the store and the customer; a store question waits for the customer's answer. */
export async function postRequestMessage(ctx: AppContext, viewer: AccessClaims, id: number, body: string) {
  if (viewer.role === 'EMPLOYEE') throw forbidden('A conversa com o cliente é feita pela gerência.');
  return ctx.db.transaction((tx) => addConversationMessage({ ctx, tx, viewer }, id, body));
}

function approvalParagraphs(message: string | undefined): string[] {
  const nextStep = 'Em breve você recebe a confirmação da data e do técnico.';
  return message ? [message, nextStep] : [nextStep];
}

async function approve(step: AuditedStep, id: number, message: string | undefined) {
  const request = await loadVisible(step.tx, step.viewer, id);
  const updated = await transition(step, request, 'approve');
  if (message) await insertMessage(step, id, message);
  await notifyCustomer(step.ctx, step.tx, request, {
    subject: `Solicitação nº ${id} aprovada`,
    heading: 'Sua solicitação foi aprovada',
    paragraphs: approvalParagraphs(message),
  });
  await auditRequest(step, 'serviceRequest.approve', id);
  return updated;
}

export async function approveRequest(
  ctx: AppContext,
  viewer: AccessClaims,
  id: number,
  message: string | undefined,
  ip: string,
) {
  return ctx.db.transaction((tx) => approve({ ctx, tx, viewer, ip }, id, message));
}

async function reject(step: AuditedStep, id: number, reason: string) {
  const request = await loadVisible(step.tx, step.viewer, id);
  const updated = await transition(step, request, 'reject', { rejectionReason: reason });
  await notifyCustomer(step.ctx, step.tx, request, {
    subject: `Solicitação nº ${id} não pôde ser atendida`,
    heading: 'Não conseguiremos atender',
    paragraphs: [reason, 'Se tiver dúvidas, ligue para a loja.'],
  });
  await auditRequest(step, 'serviceRequest.reject', id);
  return updated;
}

export async function rejectRequest(
  ctx: AppContext,
  viewer: AccessClaims,
  id: number,
  reason: string,
  ip: string,
) {
  return ctx.db.transaction((tx) => reject({ ctx, tx, viewer, ip }, id, reason));
}

function assertBeforeCustomerDeadline(step: AuditedStep, appointment: Appointment) {
  if (appointment && step.ctx.clock.now() >= customerCancellationDeadline(appointment.startsAt)) {
    throw cancellationDeadlinePassed();
  }
}

async function announceCustomerCancellation(step: AuditedStep, request: repo.RequestRow, reason?: string) {
  await notifyManagement(step.ctx, step.tx, null, {
    subject: `Solicitação nº ${request.id} cancelada pelo cliente`,
    heading: 'Cancelamento do cliente',
    paragraphs: [reason ?? 'O cliente não informou o motivo.'],
    requestId: request.id,
  });
}

async function announceStoreCancellation(step: AuditedStep, request: repo.RequestRow, reason?: string) {
  await notifyCustomer(step.ctx, step.tx, request, {
    subject: `Solicitação nº ${request.id} cancelada`,
    heading: 'Solicitação cancelada',
    paragraphs: [reason ?? 'A loja cancelou esta solicitação. Ligue para a gente se tiver dúvidas.'],
  });
  await auditRequest(step, 'serviceRequest.cancel', request.id);
}

const anyTimeBeforeTheVisit = () => undefined;

/** Customers cancel until 18:00 of the day before the visit; management cancels any open request. */
const CANCELLATION_FLOWS: Readonly<Record<ActorKind, CancellationFlow>> = {
  customer: { assertAllowed: assertBeforeCustomerDeadline, announce: announceCustomerCancellation },
  staff: { assertAllowed: anyTimeBeforeTheVisit, announce: announceStoreCancellation },
};

async function cancel(step: AuditedStep, id: number, reason: string | undefined) {
  const request = await loadVisible(step.tx, step.viewer, id);
  const appointment = await repo.findAppointmentForRequest(step.tx, id);
  const flow = CANCELLATION_FLOWS[actorKind(step.viewer.role)];
  flow.assertAllowed(step, appointment);
  const updated = await transition(step, request, 'cancel', { cancellationReason: reason ?? null });
  await repo.deleteAppointmentForRequest(step.tx, id);
  await flow.announce(step, request, reason);
  if (appointment) await notifyVisitCanceled(step.ctx, step.tx, appointment.employeeId, id);
  return updated;
}

export async function cancelRequest(
  ctx: AppContext,
  viewer: AccessClaims,
  id: number,
  reason: string | undefined,
  ip: string,
) {
  return ctx.db.transaction((tx) => cancel({ ctx, tx, viewer, ip }, id, reason));
}
