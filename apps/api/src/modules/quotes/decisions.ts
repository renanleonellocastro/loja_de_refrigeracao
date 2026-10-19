import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { conflict } from '../../shared/errors.js';
import { formatBrl, formatDateBr } from '../../shared/text.js';
import type { AccessClaims } from '../auth/service.js';
import * as services from '../services/service.js';
import { isWithinValidity, lockVisible, nextOrFail } from './access.js';
import { NO_REASON_GIVEN, auditQuote, notifyCustomer, notifyManagement } from './notices.js';
import * as repo from './repository.js';
import type { QuoteAcceptance, QuoteAnswer } from './schemas.js';
import { quoteActor, type QuotePerson, type QuoteStatus } from './status.js';

/** Who asks for a decision on which quote, with what, from where. */
interface DecisionRequest<Input> {
  viewer: AccessClaims;
  id: number;
  input: Input;
  ip: string;
}

function saveAnswer(tx: Executor, request: DecisionRequest<QuoteAnswer>, status: QuoteStatus, now: Date) {
  const { input, viewer } = request;
  return repo.updateQuote(tx, request.id, {
    status,
    amountCents: input.amountCents,
    validUntil: services.saoPauloDate(now, input.validityDays),
    included: input.included,
    notes: input.notes || null,
    answeredById: viewer.userId,
    answeredAt: now,
    updatedAt: now,
  });
}

function answerParagraphs(input: QuoteAnswer, answered: repo.QuoteRow): string[] {
  return [
    `Valor: ${formatBrl(input.amountCents)}.`,
    `Válido até ${formatDateBr(answered.validUntil!)}.`,
    `O que está incluído: ${input.included}`,
    ...(answered.notes ? [`Observações: ${answered.notes}`] : []),
    'Abra o orçamento para aceitar ou recusar. Ao aceitar, você escolhe as datas para a visita.',
  ];
}

function tellAnswerReady(ctx: AppContext, tx: Executor, input: QuoteAnswer, answered: repo.QuoteRow) {
  return notifyCustomer(ctx, tx, answered, {
    subject: `Seu orçamento nº ${answered.id} está pronto`,
    heading: 'Seu orçamento está pronto',
    paragraphs: answerParagraphs(input, answered),
    actionLabel: 'Aceitar ou recusar',
  });
}

function auditAnswer(
  tx: Executor,
  request: DecisionRequest<QuoteAnswer>,
  before: repo.QuoteRow,
  after: repo.QuoteRow,
) {
  return auditQuote(tx, {
    actorId: request.viewer.userId,
    action: 'quote.answer',
    resourceId: before.id,
    before,
    after,
    ip: request.ip,
  });
}

async function recordAnswer(ctx: AppContext, tx: Executor, request: DecisionRequest<QuoteAnswer>) {
  const quote = await lockVisible(tx, request.viewer, request.id);
  const status = nextOrFail(quote, 'answer', 'staff');
  const updated = await saveAnswer(tx, request, status, ctx.clock.now());
  await tellAnswerReady(ctx, tx, request.input, updated);
  await auditAnswer(tx, request, quote, updated);
  return updated;
}

/** UC Responder Orçamento: value, validity in days, what is included and notes. */
export async function answerQuote(
  ctx: AppContext,
  viewer: AccessClaims,
  id: number,
  input: QuoteAnswer,
  ip: string,
) {
  return ctx.db.transaction((tx) => recordAnswer(ctx, tx, { viewer, id, input, ip }));
}

function assertStillValid(quote: repo.QuoteRow, now: Date): void {
  if (isWithinValidity(quote, now)) return;
  throw conflict(
    'quote-expired',
    'Orçamento vencido',
    `Este orçamento valia até ${formatDateBr(quote.validUntil!)}. Peça um novo orçamento.`,
  );
}

async function openServiceRequest(
  ctx: AppContext,
  tx: Executor,
  quote: repo.QuoteRow,
  request: DecisionRequest<QuoteAcceptance>,
) {
  const type = await services.findServiceType(tx, quote.serviceTypeId);
  const { input } = request;
  const visit = {
    serviceTypeId: quote.serviceTypeId,
    productKind: input.productKind ?? type!.name,
    brand: input.brand,
    model: input.model,
    problem: quote.description,
    windows: input.windows,
    address: input.address,
  };
  return services.createRequest(ctx, request.viewer, visit, request.ip, quote.id, tx);
}

async function announceAcceptance(
  ctx: AppContext,
  tx: Executor,
  quote: repo.QuoteRow,
  serviceRequestId: number,
) {
  const customer = await repo.findPerson(tx, quote.customerId);
  await notifyManagement(ctx, tx, null, quote.id, {
    subject: `Orçamento nº ${quote.id} aceito`,
    heading: 'Orçamento aceito',
    paragraphs: [
      `${customer.name} aceitou o orçamento de ${formatBrl(quote.amountCents!)}.`,
      `A solicitação de agendamento nº ${serviceRequestId} foi criada e aguarda a aprovação da visita.`,
    ],
  });
}

async function recordAcceptance(ctx: AppContext, tx: Executor, request: DecisionRequest<QuoteAcceptance>) {
  const quote = await lockVisible(tx, request.viewer, request.id);
  const status = nextOrFail(quote, 'accept', 'customer');
  const now = ctx.clock.now();
  assertStillValid(quote, now);
  await repo.updateQuote(tx, quote.id, { status, decidedAt: now, updatedAt: now });
  const serviceRequest = await openServiceRequest(ctx, tx, quote, request);
  await announceAcceptance(ctx, tx, quote, serviceRequest.id);
  return serviceRequest.id;
}

/**
 * UC Aceitar Orçamento: the quote becomes ACCEPTED and a service request linked to it is created in the
 * same transaction, so both happen or neither does. Returns the new service request id.
 */
export async function acceptQuote(
  ctx: AppContext,
  viewer: AccessClaims,
  id: number,
  input: QuoteAcceptance,
  ip: string,
) {
  return ctx.db.transaction((tx) => recordAcceptance(ctx, tx, { viewer, id, input, ip }));
}

/** UC Recusar Orçamento, with an optional reason. */
export async function declineQuote(
  ctx: AppContext,
  viewer: AccessClaims,
  id: number,
  reason: string | undefined,
) {
  return ctx.db.transaction(async (tx) => {
    const quote = await lockVisible(tx, viewer, id);
    const status = nextOrFail(quote, 'decline', 'customer');
    const now = ctx.clock.now();
    await repo.updateQuote(tx, id, { status, declineReason: reason || null, decidedAt: now, updatedAt: now });
    const customer = await repo.findPerson(tx, quote.customerId);
    await notifyManagement(ctx, tx, null, id, {
      subject: `Orçamento nº ${id} recusado`,
      heading: 'Orçamento recusado',
      paragraphs: [`${customer.name} recusou o orçamento.`, reason || NO_REASON_GIVEN],
    });
  });
}

type CancellationEffect = (
  ctx: AppContext,
  tx: Executor,
  quote: repo.QuoteRow,
  request: DecisionRequest<string | undefined>,
) => Promise<void>;

async function cancelByStaff(
  ctx: AppContext,
  tx: Executor,
  quote: repo.QuoteRow,
  request: DecisionRequest<string | undefined>,
) {
  await notifyCustomer(ctx, tx, quote, {
    subject: `Orçamento nº ${quote.id} cancelado`,
    heading: 'Orçamento cancelado',
    paragraphs: [request.input || 'A loja cancelou este orçamento. Ligue para a gente se tiver dúvidas.'],
  });
  await auditQuote(tx, {
    actorId: request.viewer.userId,
    action: 'quote.cancel',
    resourceId: quote.id,
    ip: request.ip,
  });
}

/** The customer's cancellation is told to the store; the store's is told to the customer and audited. */
const CANCELLATION_EFFECTS: Readonly<Record<QuotePerson, CancellationEffect>> = {
  customer: (ctx, tx, quote, request) =>
    notifyManagement(ctx, tx, null, quote.id, {
      subject: `Orçamento nº ${quote.id} cancelado pelo cliente`,
      heading: 'Cancelamento do cliente',
      paragraphs: [request.input || NO_REASON_GIVEN],
    }),
  staff: cancelByStaff,
};

async function recordCancellation(
  ctx: AppContext,
  tx: Executor,
  request: DecisionRequest<string | undefined>,
) {
  const { viewer, input: reason } = request;
  const quote = await lockVisible(tx, viewer, request.id);
  const actor = quoteActor(viewer.role);
  const status = nextOrFail(quote, 'cancel', actor);
  const now = ctx.clock.now();
  await repo.updateQuote(tx, quote.id, { status, updatedAt: now });
  if (reason) await services.insertMessage(tx, 'QUOTE', quote.id, viewer.userId, reason, now);
  await CANCELLATION_EFFECTS[actor](ctx, tx, quote, request);
}

/** The customer cancels while the quote waits for an answer; management cancels any open quote. */
export async function cancelQuote(
  ctx: AppContext,
  viewer: AccessClaims,
  id: number,
  reason: string | undefined,
  ip: string,
) {
  return ctx.db.transaction((tx) => recordCancellation(ctx, tx, { viewer, id, input: reason, ip }));
}
