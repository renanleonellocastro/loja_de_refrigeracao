import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { forbidden, notFound, unprocessable } from '../../shared/errors.js';
import type { AccessClaims } from '../auth/service.js';
import * as notifications from '../notifications/service.js';
import * as services from '../services/service.js';
import * as users from '../users/service.js';
import { QUOTE_NOTICE_TYPE, auditQuote, customerQuotePath, notifyManagement } from './notices.js';
import * as repo from './repository.js';
import type { QuoteCreation } from './schemas.js';
import { QUOTE_STATUS_LABELS } from './status.js';

type ServiceType = NonNullable<Awaited<ReturnType<typeof services.findServiceType>>>;

interface QuoteRequest {
  actor: AccessClaims;
  input: QuoteCreation;
  customerId: number;
  ip: string;
}

/** What the notices of a new quote talk about. */
interface OpenedQuote {
  quote: repo.QuoteRow;
  customer: users.UserRow;
  type: ServiceType;
  description: string;
}

/** A customer asks only for themselves. */
function ownCustomerId(actor: AccessClaims, customerId: number | undefined): number {
  if (customerId === undefined || customerId === actor.userId) return actor.userId;
  throw forbidden('Você só pode pedir orçamentos para a sua conta.');
}

/** The store asks on behalf of a customer it must name (decision D7). */
function chosenCustomerId(customerId: number | undefined): number {
  if (customerId !== undefined) return customerId;
  throw unprocessable(
    'customer-required',
    'Cliente obrigatório',
    'Informe para qual cliente é o orçamento.',
    {
      errors: [{ path: 'customerId', message: 'Escolha o cliente.' }],
    },
  );
}

function customerIdFor(actor: AccessClaims, input: QuoteCreation): number {
  if (actor.role === 'CLIENT') return ownCustomerId(actor, input.customerId);
  return chosenCustomerId(input.customerId);
}

async function findCustomer(db: Executor, customerId: number): Promise<users.UserRow> {
  const customer = await users.findActiveUserById(db, customerId);
  if (customer && customer.role === 'CLIENT') return customer;
  throw notFound('Cliente não encontrado.');
}

async function findActiveServiceType(db: Executor, serviceTypeId: number): Promise<ServiceType> {
  const type = await services.findServiceType(db, serviceTypeId);
  if (type && type.active) return type;
  throw unprocessable(
    'invalid-service-type',
    'Serviço indisponível',
    'Escolha um dos serviços disponíveis.',
    {
      errors: [{ path: 'serviceTypeId', message: 'Serviço indisponível.' }],
    },
  );
}

function insertRequestedQuote(ctx: AppContext, tx: Executor, request: QuoteRequest, serviceTypeId: number) {
  const now = ctx.clock.now();
  return repo.insertQuote(tx, {
    customerId: request.customerId,
    serviceTypeId,
    description: request.input.description,
    createdById: request.actor.userId,
    createdAt: now,
    updatedAt: now,
  });
}

function requestParagraphs({ quote, type, description }: OpenedQuote): string[] {
  return [
    `Serviço: ${type.name}.`,
    `Descrição: ${description}`,
    `Situação: ${QUOTE_STATUS_LABELS[quote.status]}.`,
    'Assim que a loja analisar o pedido, você recebe por email o valor e a validade do orçamento.',
  ];
}

function confirmToCustomer(ctx: AppContext, tx: Executor, opened: OpenedQuote) {
  const { quote, customer } = opened;
  return notifications.notifyUser(ctx, tx, customer, {
    type: QUOTE_NOTICE_TYPE,
    subject: `Recebemos seu pedido de orçamento nº ${quote.id}`,
    heading: 'Recebemos seu pedido de orçamento',
    paragraphs: requestParagraphs(opened),
    path: customerQuotePath(quote.id),
    actionLabel: 'Acompanhar orçamento',
  });
}

function alertManagement(ctx: AppContext, tx: Executor, authorId: number, opened: OpenedQuote) {
  const { quote, customer, type, description } = opened;
  return notifyManagement(ctx, tx, authorId, quote.id, {
    subject: `Novo pedido de orçamento nº ${quote.id}: ${type.name}`,
    heading: 'Novo pedido de orçamento',
    paragraphs: [`${customer.name} pediu um orçamento de ${type.name.toLowerCase()}.`, description],
  });
}

/** Quotes the store opens for a customer go to the audit trail; the customer's own do not. */
async function auditIfOnBehalf(tx: Executor, request: QuoteRequest, quote: repo.QuoteRow): Promise<void> {
  if (request.actor.role === 'CLIENT') return;
  await auditQuote(tx, {
    actorId: request.actor.userId,
    action: 'quote.create',
    resourceId: quote.id,
    after: quote,
    ip: request.ip,
  });
}

async function openQuote(ctx: AppContext, tx: Executor, request: QuoteRequest) {
  const customer = await findCustomer(tx, request.customerId);
  const type = await findActiveServiceType(tx, request.input.serviceTypeId);
  const quote = await insertRequestedQuote(ctx, tx, request, type.id);
  const opened: OpenedQuote = { quote, customer, type, description: request.input.description };
  await confirmToCustomer(ctx, tx, opened);
  await alertManagement(ctx, tx, request.actor.userId, opened);
  await auditIfOnBehalf(tx, request, quote);
  return quote;
}

/** UC Solicitar Orçamento: by the customer or by management on behalf of a customer (decision D7). */
export async function createQuote(ctx: AppContext, actor: AccessClaims, input: QuoteCreation, ip: string) {
  const customerId = customerIdFor(actor, input);
  return ctx.db.transaction((tx) => openQuote(ctx, tx, { actor, input, customerId, ip }));
}
