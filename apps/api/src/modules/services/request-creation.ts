import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import type { AddressSnapshot } from '../../infra/db/schema.js';
import { forbidden, notFound, unprocessable } from '../../shared/errors.js';
import { recordAudit } from '../audit/service.js';
import type { AccessClaims } from '../auth/service.js';
import * as notifications from '../notifications/service.js';
import * as users from '../users/service.js';
import * as repo from './repository.js';
import { customerRequestPath, notifyManagement } from './request-notices.js';
import type { RequestCreation } from './schemas.js';
import { saoPauloDate } from './status.js';

const MAX_WINDOW_DAYS_AHEAD = 60;

type Window = RequestCreation['windows'][number];
type Customer = NonNullable<Awaited<ReturnType<typeof users.findActiveUserById>>>;
type SavedAddress = NonNullable<Awaited<ReturnType<typeof users.findAddress>>>;

/** A field the customer must fix, with the message shown next to it. */
interface FieldProblem {
  readonly slug: string;
  readonly title: string;
  readonly detail: string;
  readonly path: string;
  readonly message: string;
}

/** One request being created: who asks, for whom, what, and inside which transaction. */
interface Creation {
  readonly ctx: AppContext;
  readonly tx: Executor;
  readonly actor: AccessClaims;
  readonly input: RequestCreation;
  readonly customerId: number;
  readonly quoteId: number | null;
  readonly ip: string;
}

/** What the new request was made of, for the notices that announce it. */
interface CreatedRequest {
  readonly request: repo.RequestRow;
  readonly customer: Customer;
  readonly serviceType: repo.ServiceTypeRow;
}

const CUSTOMER_REQUIRED: FieldProblem = {
  slug: 'customer-required',
  title: 'Cliente obrigatório',
  detail: 'Informe para qual cliente é a solicitação.',
  path: 'customerId',
  message: 'Escolha o cliente.',
};

const SERVICE_TYPE_UNAVAILABLE: FieldProblem = {
  slug: 'invalid-service-type',
  title: 'Serviço indisponível',
  detail: 'Escolha um dos serviços disponíveis.',
  path: 'serviceTypeId',
  message: 'Serviço indisponível.',
};

const ADDRESS_REQUIRED: FieldProblem = {
  slug: 'address-required',
  title: 'Endereço obrigatório',
  detail: 'Informe o endereço do atendimento.',
  path: 'address',
  message: 'Informe o endereço do atendimento.',
};

const invalidField = ({ slug, title, detail, path, message }: FieldProblem) =>
  unprocessable(slug, title, detail, { errors: [{ path, message }] });

const invalidWindow = (index: number, message: string) =>
  invalidField({
    slug: 'invalid-window',
    title: 'Data de visita inválida',
    detail: message,
    path: `windows.${index}.day`,
    message,
  });

const isOnBehalf = (actor: AccessClaims) => actor.role !== 'CLIENT';

function ownAccountId(actor: AccessClaims, requestedCustomerId: number | undefined): number {
  if (requestedCustomerId !== undefined && requestedCustomerId !== actor.userId) {
    throw forbidden('Você só pode pedir serviços para a sua conta.');
  }
  return actor.userId;
}

function chosenCustomerId(requestedCustomerId: number | undefined): number {
  if (requestedCustomerId === undefined) throw invalidField(CUSTOMER_REQUIRED);
  return requestedCustomerId;
}

/** A customer asks for their own account; the staff must say for which customer they ask. */
function resolveCustomerId(actor: AccessClaims, requestedCustomerId: number | undefined): number {
  if (isOnBehalf(actor)) return chosenCustomerId(requestedCustomerId);
  return ownAccountId(actor, requestedCustomerId);
}

function windowProblem(window: Window, range: { first: string; last: string }, seen: Set<string>) {
  if (window.day < range.first) return 'Escolha datas a partir de amanhã.';
  if (window.day > range.last) return `Escolha datas nos próximos ${MAX_WINDOW_DAYS_AHEAD} dias.`;
  if (seen.has(`${window.day} ${window.period}`)) return 'Esta data e período já foram escolhidos.';
  return null;
}

/** Visit windows go from tomorrow up to the horizon, each day and period chosen once. */
function validateWindows(windows: readonly Window[], now: Date) {
  const range = { first: saoPauloDate(now, 1), last: saoPauloDate(now, MAX_WINDOW_DAYS_AHEAD) };
  const seen = new Set<string>();
  windows.forEach((window, index) => {
    const problem = windowProblem(window, range, seen);
    if (problem) throw invalidWindow(index, problem);
    seen.add(`${window.day} ${window.period}`);
  });
}

async function findClientOrFail(tx: Executor, customerId: number): Promise<Customer> {
  const customer = await users.findActiveUserById(tx, customerId);
  if (!customer || customer.role !== 'CLIENT') throw notFound('Cliente não encontrado.');
  return customer;
}

async function findActiveServiceTypeOrFail(tx: Executor, id: number): Promise<repo.ServiceTypeRow> {
  const serviceType = await repo.findServiceType(tx, id);
  if (!serviceType || !serviceType.active) throw invalidField(SERVICE_TYPE_UNAVAILABLE);
  return serviceType;
}

function toAddressSnapshot(saved: SavedAddress): AddressSnapshot {
  const { cep, street, number, complement, district, city, state } = saved;
  return { cep, street, number, complement, district, city, state };
}

/** The address typed in the request, or else the one saved in the customer's account. */
async function visitAddress(creation: Creation): Promise<AddressSnapshot> {
  if (creation.input.address) return creation.input.address;
  const saved = await users.findAddress(creation.tx, creation.customerId);
  if (!saved) throw invalidField(ADDRESS_REQUIRED);
  return toAddressSnapshot(saved);
}

/** Brand and model are optional: an empty answer is stored as unknown. */
function equipmentValues(input: RequestCreation) {
  const { productKind, brand, model, problem } = input;
  return { productKind, brand: brand || null, model: model || null, problem };
}

function insertRequestRow(creation: Creation, serviceTypeId: number, address: AddressSnapshot) {
  const now = creation.ctx.clock.now();
  return repo.insertRequest(creation.tx, {
    customerId: creation.customerId,
    serviceTypeId,
    ...equipmentValues(creation.input),
    address,
    quoteId: creation.quoteId,
    createdById: creation.actor.userId,
    createdAt: now,
    updatedAt: now,
  });
}

function confirmToCustomer(creation: Creation, { request, customer, serviceType }: CreatedRequest) {
  return notifications.notifyUser(creation.ctx, creation.tx, customer, {
    type: 'serviceRequest',
    subject: `Recebemos sua solicitação nº ${request.id}`,
    heading: 'Solicitação recebida',
    paragraphs: [
      `Recebemos o pedido de ${serviceType.name.toLowerCase()} para ${creation.input.productKind}.`,
      'A gente responde em até 1 dia útil para confirmar a data da visita.',
    ],
    path: customerRequestPath(request.id),
    actionLabel: 'Acompanhar solicitação',
  });
}

function announceToManagement(creation: Creation, { request, customer, serviceType }: CreatedRequest) {
  const { input } = creation;
  return notifyManagement(creation.ctx, creation.tx, creation.actor.userId, {
    subject: `Nova solicitação nº ${request.id}: ${serviceType.name}`,
    heading: 'Nova solicitação de serviço',
    paragraphs: [
      `${customer.name} pediu ${serviceType.name.toLowerCase()} (${input.productKind}).`,
      input.problem,
    ],
    requestId: request.id,
  });
}

/** Requests made by the staff on behalf of a customer stay in the audit trail. */
async function auditOnBehalfCreation(creation: Creation, request: repo.RequestRow) {
  if (!isOnBehalf(creation.actor)) return;
  await recordAudit(creation.tx, {
    actorId: creation.actor.userId,
    action: 'serviceRequest.create',
    resourceType: 'serviceRequest',
    resourceId: request.id,
    after: request,
    ip: creation.ip,
  });
}

async function registerRequest(creation: Creation): Promise<repo.RequestRow> {
  const customer = await findClientOrFail(creation.tx, creation.customerId);
  const serviceType = await findActiveServiceTypeOrFail(creation.tx, creation.input.serviceTypeId);
  const address = await visitAddress(creation);
  const request = await insertRequestRow(creation, serviceType.id, address);
  await repo.insertWindows(creation.tx, request.id, creation.input.windows);
  await confirmToCustomer(creation, { request, customer, serviceType });
  await announceToManagement(creation, { request, customer, serviceType });
  await auditOnBehalfCreation(creation, request);
  return request;
}

/**
 * UC Solicitar Agendamento: by the customer or by the staff on behalf of a customer (decision D7).
 * Runs in its own transaction, or inside `executor` when the caller needs it to be part of a larger one
 * (an accepted quote and its request are created together or not at all).
 */
export async function createRequest(
  ctx: AppContext,
  actor: AccessClaims,
  input: RequestCreation,
  ip: string,
  quoteId: number | null = null,
  executor?: Executor,
) {
  const customerId = resolveCustomerId(actor, input.customerId);
  validateWindows(input.windows, ctx.clock.now());
  const register = (tx: Executor) => registerRequest({ ctx, tx, actor, input, customerId, quoteId, ip });
  return executor ? register(executor) : ctx.db.transaction(register);
}
