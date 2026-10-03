import type { Role } from '@rc/contracts';
import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { conflict, forbidden, notFound, unprocessable } from '../../shared/errors.js';
import { pageOf } from '../../shared/pagination.js';
import { formatBrl, formatDateBr } from '../../shared/text.js';
import { recordAudit } from '../audit/service.js';
import type { AccessClaims } from '../auth/service.js';
import { queueEmail } from '../mail/service.js';
import { imageView, storeImage } from '../media/service.js';
import * as services from '../services/service.js';
import * as users from '../users/service.js';
import * as repo from './repository.js';
import type { QuoteAcceptance, QuoteAnswer, QuoteCreation } from './schemas.js';
import {
  QUOTE_STATUS_LABELS,
  nextQuoteStatus,
  quoteActor,
  type QuoteAction,
  type QuoteActor,
  type QuoteStatus,
} from './status.js';

export const MAX_QUOTE_PHOTOS = 6;

type MailContext = Pick<AppContext, 'db' | 'clock' | 'config'>;

const isManagement = (role: Role) => role === 'MANAGER' || role === 'ADMIN';

function customerLink(ctx: MailContext, id: number) {
  return `${ctx.config.APP_ORIGIN}/minha-conta/orcamentos/${id}`;
}

function staffLink(ctx: MailContext, id: number) {
  return `${ctx.config.APP_ORIGIN}/orcamentos/${id}`;
}

/** Emails every manager and super user (except the author of the change). */
async function notifyManagement(
  ctx: MailContext,
  db: Executor,
  exceptUserId: number | null,
  quoteId: number,
  message: { subject: string; heading: string; paragraphs: string[] },
) {
  for (const person of await users.activeEmailsByRole(db, ['MANAGER', 'ADMIN'])) {
    if (person.id === exceptUserId) continue;
    await queueEmail(db, person.email, 'notice', {
      name: person.name,
      ...message,
      link: staffLink(ctx, quoteId),
      actionLabel: 'Abrir orçamento',
    });
  }
}

async function notifyCustomer(
  ctx: MailContext,
  db: Executor,
  quote: repo.QuoteRow,
  message: { subject: string; heading: string; paragraphs: string[]; actionLabel?: string },
) {
  const customer = await users.findActiveUserById(db, quote.customerId);
  if (!customer) return;
  await queueEmail(db, customer.email, 'notice', {
    name: customer.name,
    actionLabel: 'Ver meu orçamento',
    ...message,
    link: customerLink(ctx, quote.id),
  });
}

/** Loads a quote the viewer may see: their own (customer) or any (management). Others get 404. */
export async function loadVisible(db: Executor, viewer: AccessClaims, id: number, forUpdate = false) {
  const quote = await (forUpdate ? repo.findQuoteForUpdate(db, id) : repo.findQuote(db, id));
  if (quote && (isManagement(viewer.role) || quote.customerId === viewer.userId)) return quote;
  throw notFound('Orçamento não encontrado.');
}

/** Answered quotes can be accepted up to and including their last valid day in São Paulo. */
function isWithinValidity(quote: repo.QuoteRow, now: Date) {
  return quote.validUntil! >= services.saoPauloDate(now);
}

const invalidTransition = (status: QuoteStatus) =>
  conflict(
    'invalid-transition',
    'Ação indisponível',
    `Não é possível fazer isso com um orçamento ${QUOTE_STATUS_LABELS[status].toLowerCase()}.`,
  );

function nextOrFail(quote: repo.QuoteRow, action: QuoteAction, actor: QuoteActor) {
  const next = nextQuoteStatus(quote.status, action, actor);
  if (next === null) throw invalidTransition(quote.status);
  return next;
}

function serviceTypeUnavailable() {
  return unprocessable(
    'invalid-service-type',
    'Serviço indisponível',
    'Escolha um dos serviços disponíveis.',
    {
      errors: [{ path: 'serviceTypeId', message: 'Serviço indisponível.' }],
    },
  );
}

/** UC Solicitar Orçamento: by the customer or by management on behalf of a customer (decision D7). */
export async function createQuote(ctx: AppContext, actor: AccessClaims, input: QuoteCreation, ip: string) {
  const onBehalf = actor.role !== 'CLIENT';
  if (!onBehalf && input.customerId !== undefined && input.customerId !== actor.userId) {
    throw forbidden('Você só pode pedir orçamentos para a sua conta.');
  }
  if (onBehalf && input.customerId === undefined) {
    throw unprocessable(
      'customer-required',
      'Cliente obrigatório',
      'Informe para qual cliente é o orçamento.',
      {
        errors: [{ path: 'customerId', message: 'Escolha o cliente.' }],
      },
    );
  }
  const customerId = onBehalf ? input.customerId! : actor.userId;

  return ctx.db.transaction(async (tx) => {
    const customer = await users.findActiveUserById(tx, customerId);
    if (!customer || customer.role !== 'CLIENT') throw notFound('Cliente não encontrado.');
    const type = await services.findServiceType(tx, input.serviceTypeId);
    if (!type || !type.active) throw serviceTypeUnavailable();
    const now = ctx.clock.now();
    const quote = await repo.insertQuote(tx, {
      customerId,
      serviceTypeId: type.id,
      description: input.description,
      createdById: actor.userId,
      createdAt: now,
      updatedAt: now,
    });
    await queueEmail(tx, customer.email, 'notice', {
      name: customer.name,
      subject: `Recebemos seu pedido de orçamento nº ${quote.id}`,
      heading: 'Recebemos seu pedido de orçamento',
      paragraphs: [
        `Serviço: ${type.name}.`,
        `Descrição: ${input.description}`,
        `Situação: ${QUOTE_STATUS_LABELS[quote.status]}.`,
        'Assim que a loja analisar o pedido, você recebe por email o valor e a validade do orçamento.',
      ],
      link: customerLink(ctx, quote.id),
      actionLabel: 'Acompanhar orçamento',
    });
    await notifyManagement(ctx, tx, actor.userId, quote.id, {
      subject: `Novo pedido de orçamento nº ${quote.id}: ${type.name}`,
      heading: 'Novo pedido de orçamento',
      paragraphs: [`${customer.name} pediu um orçamento de ${type.name.toLowerCase()}.`, input.description],
    });
    if (onBehalf) {
      await recordAudit(tx, {
        actorId: actor.userId,
        action: 'quote.create',
        resourceType: 'quote',
        resourceId: quote.id,
        after: quote,
        ip,
      });
    }
    return quote;
  });
}

async function photosOf(db: Executor, id: number) {
  return (await services.listMedia(db, 'QUOTE', id)).map((p) => ({
    id: p.id,
    ...imageView({ key: p.storageKey, width: p.width, height: p.height }),
  }));
}

export async function quoteDetail(ctx: AppContext, viewer: AccessClaims, id: number) {
  const quote = await loadVisible(ctx.db, viewer, id);
  const [type, customer, photos, answeredBy, serviceRequestId] = await Promise.all([
    services.findServiceType(ctx.db, quote.serviceTypeId),
    repo.findPerson(ctx.db, quote.customerId),
    photosOf(ctx.db, id),
    quote.answeredById === null ? null : repo.findPerson(ctx.db, quote.answeredById),
    repo.findRequestIdForQuote(ctx.db, id),
  ]);
  const actor = quoteActor(viewer.role);
  const now = ctx.clock.now();
  return {
    id: quote.id,
    status: quote.status,
    statusLabel: QUOTE_STATUS_LABELS[quote.status],
    serviceType: { id: type!.id, name: type!.name },
    description: quote.description,
    photos,
    customer,
    amountCents: quote.amountCents,
    validUntil: quote.validUntil,
    included: quote.included,
    notes: quote.notes,
    answeredBy: answeredBy && { id: answeredBy.id, name: answeredBy.name },
    answeredAt: quote.answeredAt,
    decidedAt: quote.decidedAt,
    declineReason: quote.declineReason,
    serviceRequestId,
    canAccept: nextQuoteStatus(quote.status, 'accept', actor) !== null && isWithinValidity(quote, now),
    canDecline: nextQuoteStatus(quote.status, 'decline', actor) !== null,
    canCancel: nextQuoteStatus(quote.status, 'cancel', actor) !== null,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
  };
}

export async function listVisibleQuotes(
  ctx: AppContext,
  viewer: AccessClaims,
  query: { status?: QuoteStatus[] | undefined; q?: string | undefined; page: number; pageSize: number },
) {
  const customerView = viewer.role === 'CLIENT';
  const { rows, total } = await repo.listQuotes(ctx.db, {
    customerId: customerView ? viewer.userId : undefined,
    statuses: query.status,
    q: customerView ? undefined : query.q,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
  const data = rows.map((r) => ({
    id: r.id,
    status: r.status,
    statusLabel: QUOTE_STATUS_LABELS[r.status],
    serviceType: r.serviceType,
    customer: { id: r.customerId, name: r.customerName },
    amountCents: r.amountCents,
    validUntil: r.validUntil,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
  return pageOf(data, query, total);
}

/** Photos of the problem: the customer while the quote waits for an answer, management while it is open. */
export async function addPhotos(ctx: AppContext, viewer: AccessClaims, id: number, files: Buffer[]) {
  const quote = await loadVisible(ctx.db, viewer, id);
  const action = viewer.role === 'CLIENT' ? 'customerPhotos' : 'staffPhotos';
  if (nextQuoteStatus(quote.status, action, quoteActor(viewer.role)) === null) {
    throw conflict('photos-locked', 'Não é possível enviar fotos', 'Este orçamento não aceita mais fotos.');
  }
  const existing = await services.listMedia(ctx.db, 'QUOTE', id);
  if (existing.length + files.length > MAX_QUOTE_PHOTOS) {
    throw unprocessable(
      'too-many-photos',
      'Fotos demais',
      `Cada orçamento aceita até ${MAX_QUOTE_PHOTOS} fotos.`,
    );
  }
  const stored: Array<{ key: string; width: number; height: number }> = [];
  for (const file of files) stored.push(await storeImage(ctx.storage, file));
  await ctx.db.transaction(async (tx) => {
    for (const image of stored) await services.insertMedia(tx, 'QUOTE', id, image);
  });
  return photosOf(ctx.db, id);
}

export async function listQuoteMessages(ctx: AppContext, viewer: AccessClaims, id: number) {
  await loadVisible(ctx.db, viewer, id);
  const rows = await services.listMessages(ctx.db, 'QUOTE', id);
  return rows.map((m) => ({
    id: m.id,
    body: m.body,
    author: { id: m.authorId, name: m.authorName, role: m.authorRole },
    mine: m.authorId === viewer.userId,
    createdAt: m.createdAt,
  }));
}

/** Conversation between the store and the customer while the quote is open. */
export async function postQuoteMessage(ctx: AppContext, viewer: AccessClaims, id: number, body: string) {
  return ctx.db.transaction(async (tx) => {
    const quote = await loadVisible(tx, viewer, id, true);
    const fromCustomer = viewer.role === 'CLIENT';
    nextOrFail(quote, fromCustomer ? 'customerMessage' : 'staffMessage', quoteActor(viewer.role));
    await services.insertMessage(tx, 'QUOTE', id, viewer.userId, body, ctx.clock.now());
    if (fromCustomer) {
      await notifyManagement(ctx, tx, null, id, {
        subject: `Mensagem do cliente no orçamento nº ${id}`,
        heading: 'O cliente enviou uma mensagem',
        paragraphs: [body],
      });
    } else {
      await notifyCustomer(ctx, tx, quote, {
        subject: `Mensagem sobre seu orçamento nº ${id}`,
        heading: 'A loja enviou uma mensagem',
        paragraphs: [body, 'Responda pelo site para a gente seguir com o seu orçamento.'],
      });
    }
  });
}

/** UC Responder Orçamento: value, validity in days, what is included and notes. */
export async function answerQuote(
  ctx: AppContext,
  viewer: AccessClaims,
  id: number,
  input: QuoteAnswer,
  ip: string,
) {
  return ctx.db.transaction(async (tx) => {
    const quote = await loadVisible(tx, viewer, id, true);
    const status = nextOrFail(quote, 'answer', 'staff');
    const now = ctx.clock.now();
    const validUntil = services.saoPauloDate(now, input.validityDays);
    const updated = await repo.updateQuote(tx, id, {
      status,
      amountCents: input.amountCents,
      validUntil,
      included: input.included,
      notes: input.notes || null,
      answeredById: viewer.userId,
      answeredAt: now,
      updatedAt: now,
    });
    await notifyCustomer(ctx, tx, quote, {
      subject: `Seu orçamento nº ${id} está pronto`,
      heading: 'Seu orçamento está pronto',
      paragraphs: [
        `Valor: ${formatBrl(input.amountCents)}.`,
        `Válido até ${formatDateBr(validUntil)}.`,
        `O que está incluído: ${input.included}`,
        ...(updated.notes ? [`Observações: ${updated.notes}`] : []),
        'Abra o orçamento para aceitar ou recusar. Ao aceitar, você escolhe as datas para a visita.',
      ],
      actionLabel: 'Aceitar ou recusar',
    });
    await recordAudit(tx, {
      actorId: viewer.userId,
      action: 'quote.answer',
      resourceType: 'quote',
      resourceId: id,
      before: quote,
      after: updated,
      ip,
    });
    return updated;
  });
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
  return ctx.db.transaction(async (tx) => {
    const quote = await loadVisible(tx, viewer, id, true);
    const status = nextOrFail(quote, 'accept', 'customer');
    const now = ctx.clock.now();
    if (!isWithinValidity(quote, now)) {
      throw conflict(
        'quote-expired',
        'Orçamento vencido',
        `Este orçamento valia até ${formatDateBr(quote.validUntil!)}. Peça um novo orçamento.`,
      );
    }
    await repo.updateQuote(tx, id, { status, decidedAt: now, updatedAt: now });
    const type = await services.findServiceType(tx, quote.serviceTypeId);
    const request = await services.createRequest(
      ctx,
      viewer,
      {
        serviceTypeId: quote.serviceTypeId,
        productKind: input.productKind ?? type!.name,
        brand: input.brand,
        model: input.model,
        problem: quote.description,
        windows: input.windows,
        address: input.address,
      },
      ip,
      id,
      tx,
    );
    const customer = await repo.findPerson(tx, quote.customerId);
    await notifyManagement(ctx, tx, null, id, {
      subject: `Orçamento nº ${id} aceito`,
      heading: 'Orçamento aceito',
      paragraphs: [
        `${customer.name} aceitou o orçamento de ${formatBrl(quote.amountCents!)}.`,
        `A solicitação de agendamento nº ${request.id} foi criada e aguarda a aprovação da visita.`,
      ],
    });
    return request.id;
  });
}

/** UC Recusar Orçamento, with an optional reason. */
export async function declineQuote(
  ctx: AppContext,
  viewer: AccessClaims,
  id: number,
  reason: string | undefined,
) {
  return ctx.db.transaction(async (tx) => {
    const quote = await loadVisible(tx, viewer, id, true);
    const status = nextOrFail(quote, 'decline', 'customer');
    const now = ctx.clock.now();
    await repo.updateQuote(tx, id, { status, declineReason: reason || null, decidedAt: now, updatedAt: now });
    const customer = await repo.findPerson(tx, quote.customerId);
    await notifyManagement(ctx, tx, null, id, {
      subject: `Orçamento nº ${id} recusado`,
      heading: 'Orçamento recusado',
      paragraphs: [`${customer.name} recusou o orçamento.`, reason || 'O cliente não informou o motivo.'],
    });
  });
}

/** The customer cancels while the quote waits for an answer; management cancels any open quote. */
export async function cancelQuote(
  ctx: AppContext,
  viewer: AccessClaims,
  id: number,
  reason: string | undefined,
  ip: string,
) {
  return ctx.db.transaction(async (tx) => {
    const quote = await loadVisible(tx, viewer, id, true);
    const status = nextOrFail(quote, 'cancel', quoteActor(viewer.role));
    const now = ctx.clock.now();
    await repo.updateQuote(tx, id, { status, updatedAt: now });
    if (reason) await services.insertMessage(tx, 'QUOTE', id, viewer.userId, reason, now);
    if (viewer.role === 'CLIENT') {
      await notifyManagement(ctx, tx, null, id, {
        subject: `Orçamento nº ${id} cancelado pelo cliente`,
        heading: 'Cancelamento do cliente',
        paragraphs: [reason || 'O cliente não informou o motivo.'],
      });
      return;
    }
    await notifyCustomer(ctx, tx, quote, {
      subject: `Orçamento nº ${id} cancelado`,
      heading: 'Orçamento cancelado',
      paragraphs: [reason || 'A loja cancelou este orçamento. Ligue para a gente se tiver dúvidas.'],
    });
    await recordAudit(tx, {
      actorId: viewer.userId,
      action: 'quote.cancel',
      resourceType: 'quote',
      resourceId: id,
      ip,
    });
  });
}

/**
 * Scheduled task: every answered quote whose last valid day (São Paulo) is before today becomes EXPIRED,
 * and the customer and the management are told. Returns how many quotes expired.
 */
export async function expireQuotes(ctx: MailContext): Promise<number> {
  return ctx.db.transaction(async (tx) => {
    const now = ctx.clock.now();
    const expired = await repo.expireAnsweredBefore(tx, services.saoPauloDate(now), now);
    for (const quote of expired) {
      const validUntil = formatDateBr(quote.validUntil!);
      await notifyCustomer(ctx, tx, quote, {
        subject: `Seu orçamento nº ${quote.id} venceu`,
        heading: 'Orçamento vencido',
        paragraphs: [
          `A validade deste orçamento terminou em ${validUntil}.`,
          'Se ainda tiver interesse, peça um novo orçamento pelo site ou fale com a loja.',
        ],
      });
      await notifyManagement(ctx, tx, null, quote.id, {
        subject: `Orçamento nº ${quote.id} venceu`,
        heading: 'Orçamento vencido sem resposta',
        paragraphs: [`O cliente não respondeu até ${validUntil}.`],
      });
    }
    return expired.length;
  });
}
