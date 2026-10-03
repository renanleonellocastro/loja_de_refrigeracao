import type { Role } from '@rc/contracts';
import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import type { AddressSnapshot } from '../../infra/db/schema.js';
import { conflict, forbidden, notFound, unprocessable } from '../../shared/errors.js';
import { pageOf } from '../../shared/pagination.js';
import { recordAudit } from '../audit/service.js';
import type { AccessClaims } from '../auth/service.js';
import { queueEmail } from '../mail/service.js';
import { imageView, storeImage } from '../media/service.js';
import * as users from '../users/service.js';
import * as repo from './repository.js';
import type { RequestCreation } from './schemas.js';
import {
  REQUEST_STATUS_LABELS,
  actorKind,
  customerCancellationDeadline,
  nextRequestStatus,
  saoPauloDate,
  type RequestAction,
  type RequestStatus,
} from './status.js';

export const MAX_REQUEST_PHOTOS = 6;
export const MAX_WINDOW_DAYS_AHEAD = 60;

const isManagement = (role: Role) => role === 'MANAGER' || role === 'ADMIN';

function customerLink(ctx: AppContext, id: number) {
  return `${ctx.config.APP_ORIGIN}/minha-conta/agendamentos/${id}`;
}

function staffLink(ctx: AppContext, id: number) {
  return `${ctx.config.APP_ORIGIN}/solicitacoes/${id}`;
}

/** Emails every manager and super user (except the author of the change). */
async function notifyManagement(
  ctx: AppContext,
  db: Executor,
  exceptUserId: number | null,
  message: { subject: string; heading: string; paragraphs: string[]; link: string },
) {
  for (const person of await users.activeEmailsByRole(db, ['MANAGER', 'ADMIN'])) {
    if (person.id === exceptUserId) continue;
    await queueEmail(db, person.email, 'notice', {
      name: person.name,
      ...message,
      actionLabel: 'Abrir solicitação',
    });
  }
}

async function notifyCustomer(
  ctx: AppContext,
  db: Executor,
  request: repo.RequestRow,
  message: { subject: string; heading: string; paragraphs: string[] },
) {
  const customer = await users.findActiveUserById(db, request.customerId);
  if (!customer) return;
  await queueEmail(db, customer.email, 'notice', {
    name: customer.name,
    ...message,
    link: customerLink(ctx, request.id),
    actionLabel: 'Ver minha solicitação',
  });
}

/** Loads a request the viewer may see: their own (customer), assigned to them (employee) or any (management). */
export async function loadVisible(ctx: AppContext, db: Executor, viewer: AccessClaims, id: number) {
  const request = await repo.findRequest(db, id);
  if (!request) throw notFound('Solicitação não encontrada.');
  if (isManagement(viewer.role)) return request;
  if (viewer.role === 'CLIENT' && request.customerId === viewer.userId) return request;
  if (viewer.role === 'EMPLOYEE') {
    const appointment = await repo.findAppointmentForRequest(db, id);
    if (appointment?.employeeId === viewer.userId) return request;
  }
  throw notFound('Solicitação não encontrada.');
}

function canCancel(viewer: AccessClaims, request: repo.RequestRow, appointmentStart: Date | null, now: Date) {
  if (viewer.role === 'EMPLOYEE') return false;
  const kind = actorKind(viewer.role);
  if (nextRequestStatus(request.status, 'cancel', kind) === null) return false;
  if (kind === 'customer' && appointmentStart) return now < customerCancellationDeadline(appointmentStart);
  return true;
}

export async function requestDetail(ctx: AppContext, viewer: AccessClaims, id: number) {
  const request = await loadVisible(ctx, ctx.db, viewer, id);
  const [type, customer, windows, photos, appointment] = await Promise.all([
    repo.findServiceType(ctx.db, request.serviceTypeId),
    users.findActiveUserById(ctx.db, request.customerId),
    repo.listWindows(ctx.db, id),
    repo.listMedia(ctx.db, 'SERVICE_REQUEST', id),
    repo.findAppointmentForRequest(ctx.db, id),
  ]);
  return {
    id: request.id,
    status: request.status,
    statusLabel: REQUEST_STATUS_LABELS[request.status],
    serviceType: { id: type!.id, name: type!.name },
    productKind: request.productKind,
    brand: request.brand,
    model: request.model,
    problem: request.problem,
    address: request.address,
    windows,
    photos: photos.map((p) => ({
      id: p.id,
      ...imageView({ key: p.storageKey, width: p.width, height: p.height }),
    })),
    customer: customer
      ? { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone }
      : { id: request.customerId, name: 'Conta removida', email: '', phone: null },
    appointment: appointment
      ? {
          id: appointment.id,
          employee: { id: appointment.employeeId, name: appointment.employeeName },
          startsAt: appointment.startsAt,
          endsAt: appointment.endsAt,
        }
      : null,
    quoteId: request.quoteId,
    rejectionReason: request.rejectionReason,
    cancellationReason: request.cancellationReason,
    canCancel: canCancel(viewer, request, appointment?.startsAt ?? null, ctx.clock.now()),
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

export async function listVisibleRequests(
  ctx: AppContext,
  viewer: AccessClaims,
  query: { status?: RequestStatus[] | undefined; q?: string | undefined; page: number; pageSize: number },
) {
  const { rows, total } = await repo.listRequests(ctx.db, {
    customerId: viewer.role === 'CLIENT' ? viewer.userId : undefined,
    employeeId: viewer.role === 'EMPLOYEE' ? viewer.userId : undefined,
    statuses: query.status,
    q: viewer.role === 'CLIENT' ? undefined : query.q,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
  const data = rows.map((r) => ({
    id: r.id,
    status: r.status,
    statusLabel: REQUEST_STATUS_LABELS[r.status],
    serviceType: r.serviceType,
    productKind: r.productKind,
    customer: { id: r.customerId, name: r.customerName },
    scheduledFor: r.scheduledFor,
    employee:
      r.employeeId === null || r.employeeName === null ? null : { id: r.employeeId, name: r.employeeName },
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
  return pageOf(data, query, total);
}

function validateWindows(windows: RequestCreation['windows'], now: Date) {
  const first = saoPauloDate(now, 1);
  const last = saoPauloDate(now, MAX_WINDOW_DAYS_AHEAD);
  const seen = new Set<string>();
  windows.forEach((window, index) => {
    const id = `${window.day} ${window.period}`;
    const fail = (message: string) => {
      throw unprocessable('invalid-window', 'Data de visita inválida', message, {
        errors: [{ path: `windows.${index}.day`, message }],
      });
    };
    if (window.day < first) fail('Escolha datas a partir de amanhã.');
    if (window.day > last) fail(`Escolha datas nos próximos ${MAX_WINDOW_DAYS_AHEAD} dias.`);
    if (seen.has(id)) fail('Esta data e período já foram escolhidos.');
    seen.add(id);
  });
}

/** UC Solicitar Agendamento: by the customer or by the staff on behalf of a customer (decision D7). */
export async function createRequest(
  ctx: AppContext,
  actor: AccessClaims,
  input: RequestCreation,
  ip: string,
  quoteId: number | null = null,
) {
  const onBehalf = actor.role !== 'CLIENT';
  if (!onBehalf && input.customerId !== undefined && input.customerId !== actor.userId) {
    throw forbidden('Você só pode pedir serviços para a sua conta.');
  }
  if (onBehalf && input.customerId === undefined) {
    throw unprocessable(
      'customer-required',
      'Cliente obrigatório',
      'Informe para qual cliente é a solicitação.',
      {
        errors: [{ path: 'customerId', message: 'Escolha o cliente.' }],
      },
    );
  }
  const customerId = onBehalf ? input.customerId! : actor.userId;
  validateWindows(input.windows, ctx.clock.now());

  return ctx.db.transaction(async (tx) => {
    const customer = await users.findActiveUserById(tx, customerId);
    if (!customer || customer.role !== 'CLIENT') throw notFound('Cliente não encontrado.');
    const type = await repo.findServiceType(tx, input.serviceTypeId);
    if (!type || !type.active) {
      throw unprocessable(
        'invalid-service-type',
        'Serviço indisponível',
        'Escolha um dos serviços disponíveis.',
        {
          errors: [{ path: 'serviceTypeId', message: 'Serviço indisponível.' }],
        },
      );
    }
    let address: AddressSnapshot | undefined = input.address;
    if (!address) {
      const saved = await users.findAddress(tx, customerId);
      if (!saved) {
        throw unprocessable(
          'address-required',
          'Endereço obrigatório',
          'Informe o endereço do atendimento.',
          {
            errors: [{ path: 'address', message: 'Informe o endereço do atendimento.' }],
          },
        );
      }
      address = {
        cep: saved.cep,
        street: saved.street,
        number: saved.number,
        complement: saved.complement,
        district: saved.district,
        city: saved.city,
        state: saved.state,
      };
    }
    const now = ctx.clock.now();
    const request = await repo.insertRequest(tx, {
      customerId,
      serviceTypeId: type.id,
      productKind: input.productKind,
      brand: input.brand || null,
      model: input.model || null,
      problem: input.problem,
      address,
      quoteId,
      createdById: actor.userId,
      createdAt: now,
      updatedAt: now,
    });
    await repo.insertWindows(tx, request.id, input.windows);
    await queueEmail(tx, customer.email, 'notice', {
      name: customer.name,
      subject: `Recebemos sua solicitação nº ${request.id}`,
      heading: 'Solicitação recebida',
      paragraphs: [
        `Recebemos o pedido de ${type.name.toLowerCase()} para ${input.productKind}.`,
        'A gente responde em até 1 dia útil para confirmar a data da visita.',
      ],
      link: customerLink(ctx, request.id),
      actionLabel: 'Acompanhar solicitação',
    });
    await notifyManagement(ctx, tx, actor.userId, {
      subject: `Nova solicitação nº ${request.id}: ${type.name}`,
      heading: 'Nova solicitação de serviço',
      paragraphs: [
        `${customer.name} pediu ${type.name.toLowerCase()} (${input.productKind}).`,
        input.problem,
      ],
      link: staffLink(ctx, request.id),
    });
    if (onBehalf) {
      await recordAudit(tx, {
        actorId: actor.userId,
        action: 'serviceRequest.create',
        resourceType: 'serviceRequest',
        resourceId: request.id,
        after: request,
        ip,
      });
    }
    return request;
  });
}

export async function addPhotos(ctx: AppContext, viewer: AccessClaims, id: number, files: Buffer[]) {
  const request = await loadVisible(ctx, ctx.db, viewer, id);
  const editable =
    viewer.role === 'CLIENT'
      ? request.status === 'REQUESTED' || request.status === 'AWAITING_CUSTOMER'
      : isManagement(viewer.role) && !['COMPLETED', 'REJECTED', 'CANCELED'].includes(request.status);
  if (!editable)
    throw conflict('photos-locked', 'Não é possível enviar fotos', 'Esta solicitação não aceita mais fotos.');
  const existing = await repo.listMedia(ctx.db, 'SERVICE_REQUEST', id);
  if (existing.length + files.length > MAX_REQUEST_PHOTOS) {
    throw unprocessable(
      'too-many-photos',
      'Fotos demais',
      `Cada solicitação aceita até ${MAX_REQUEST_PHOTOS} fotos.`,
    );
  }
  const stored: Array<{ key: string; width: number; height: number }> = [];
  for (const file of files) stored.push(await storeImage(ctx.storage, file));
  await ctx.db.transaction(async (tx) => {
    for (const image of stored) await repo.insertMedia(tx, 'SERVICE_REQUEST', id, image);
  });
  return (await repo.listMedia(ctx.db, 'SERVICE_REQUEST', id)).map((p) => ({
    id: p.id,
    ...imageView({ key: p.storageKey, width: p.width, height: p.height }),
  }));
}

export async function listRequestMessages(ctx: AppContext, viewer: AccessClaims, id: number) {
  await loadVisible(ctx, ctx.db, viewer, id);
  const rows = await repo.listMessages(ctx.db, 'SERVICE_REQUEST', id);
  return rows.map((m) => ({
    id: m.id,
    body: m.body,
    author: { id: m.authorId, name: m.authorName, role: m.authorRole },
    mine: m.authorId === viewer.userId,
    createdAt: m.createdAt,
  }));
}

const invalidTransition = (status: RequestStatus) =>
  conflict(
    'invalid-transition',
    'Ação indisponível',
    `Não é possível fazer isso com uma solicitação ${REQUEST_STATUS_LABELS[status].toLowerCase()}.`,
  );

async function transition(
  ctx: AppContext,
  tx: Executor,
  request: repo.RequestRow,
  action: RequestAction,
  viewer: AccessClaims,
  extra: Partial<repo.RequestRow> = {},
) {
  const next = nextRequestStatus(request.status, action, actorKind(viewer.role));
  if (next === null) throw invalidTransition(request.status);
  return repo.updateRequest(tx, request.id, { status: next, updatedAt: ctx.clock.now(), ...extra });
}

/** Conversation between the store and the customer; a store question waits for the customer's answer. */
export async function postRequestMessage(ctx: AppContext, viewer: AccessClaims, id: number, body: string) {
  if (viewer.role === 'EMPLOYEE') throw forbidden('A conversa com o cliente é feita pela gerência.');
  return ctx.db.transaction(async (tx) => {
    const request = await loadVisible(ctx, tx, viewer, id);
    const fromCustomer = viewer.role === 'CLIENT';
    await transition(ctx, tx, request, fromCustomer ? 'customerMessage' : 'staffMessage', viewer);
    await repo.insertMessage(tx, 'SERVICE_REQUEST', id, viewer.userId, body, ctx.clock.now());
    if (fromCustomer) {
      await notifyManagement(ctx, tx, null, {
        subject: `Resposta do cliente na solicitação nº ${id}`,
        heading: 'O cliente respondeu',
        paragraphs: [body],
        link: staffLink(ctx, id),
      });
    } else {
      await notifyCustomer(ctx, tx, request, {
        subject: `Mensagem sobre sua solicitação nº ${id}`,
        heading: 'A loja enviou uma mensagem',
        paragraphs: [body, 'Responda pelo site para a gente seguir com o seu atendimento.'],
      });
    }
  });
}

export async function approveRequest(
  ctx: AppContext,
  viewer: AccessClaims,
  id: number,
  message: string | undefined,
  ip: string,
) {
  return ctx.db.transaction(async (tx) => {
    const request = await loadVisible(ctx, tx, viewer, id);
    const updated = await transition(ctx, tx, request, 'approve', viewer);
    if (message) await repo.insertMessage(tx, 'SERVICE_REQUEST', id, viewer.userId, message, ctx.clock.now());
    await notifyCustomer(ctx, tx, request, {
      subject: `Solicitação nº ${id} aprovada`,
      heading: 'Sua solicitação foi aprovada',
      paragraphs: [...(message ? [message] : []), 'Em breve você recebe a confirmação da data e do técnico.'],
    });
    await recordAudit(tx, {
      actorId: viewer.userId,
      action: 'serviceRequest.approve',
      resourceType: 'serviceRequest',
      resourceId: id,
      ip,
    });
    return updated;
  });
}

export async function rejectRequest(
  ctx: AppContext,
  viewer: AccessClaims,
  id: number,
  reason: string,
  ip: string,
) {
  return ctx.db.transaction(async (tx) => {
    const request = await loadVisible(ctx, tx, viewer, id);
    const updated = await transition(ctx, tx, request, 'reject', viewer, { rejectionReason: reason });
    await notifyCustomer(ctx, tx, request, {
      subject: `Solicitação nº ${id} não pôde ser atendida`,
      heading: 'Não conseguiremos atender',
      paragraphs: [reason, 'Se tiver dúvidas, ligue para a loja.'],
    });
    await recordAudit(tx, {
      actorId: viewer.userId,
      action: 'serviceRequest.reject',
      resourceType: 'serviceRequest',
      resourceId: id,
      ip,
    });
    return updated;
  });
}

/** Customers cancel until 18:00 of the day before the visit; management cancels any open request. */
export async function cancelRequest(
  ctx: AppContext,
  viewer: AccessClaims,
  id: number,
  reason: string | undefined,
  ip: string,
) {
  return ctx.db.transaction(async (tx) => {
    const request = await loadVisible(ctx, tx, viewer, id);
    const appointment = await repo.findAppointmentForRequest(tx, id);
    if (
      viewer.role === 'CLIENT' &&
      appointment &&
      ctx.clock.now() >= customerCancellationDeadline(appointment.startsAt)
    ) {
      throw conflict(
        'cancellation-deadline-passed',
        'Prazo de cancelamento encerrado',
        'A visita só pode ser cancelada pelo site até as 18h do dia anterior. Ligue para a loja.',
      );
    }
    const updated = await transition(ctx, tx, request, 'cancel', viewer, {
      cancellationReason: reason ?? null,
    });
    await repo.deleteAppointmentForRequest(tx, id);
    if (viewer.role === 'CLIENT') {
      await notifyManagement(ctx, tx, null, {
        subject: `Solicitação nº ${id} cancelada pelo cliente`,
        heading: 'Cancelamento do cliente',
        paragraphs: [reason ?? 'O cliente não informou o motivo.'],
        link: staffLink(ctx, id),
      });
    } else {
      await notifyCustomer(ctx, tx, request, {
        subject: `Solicitação nº ${id} cancelada`,
        heading: 'Solicitação cancelada',
        paragraphs: [reason ?? 'A loja cancelou esta solicitação. Ligue para a gente se tiver dúvidas.'],
      });
      await recordAudit(tx, {
        actorId: viewer.userId,
        action: 'serviceRequest.cancel',
        resourceType: 'serviceRequest',
        resourceId: id,
        ip,
      });
    }
    if (appointment) {
      const employee = await users.findActiveUserById(tx, appointment.employeeId);
      if (employee) {
        await queueEmail(tx, employee.email, 'notice', {
          name: employee.name,
          subject: `Visita cancelada: solicitação nº ${id}`,
          heading: 'Visita cancelada',
          paragraphs: ['Esta visita saiu da sua agenda.'],
        });
      }
    }
    return updated;
  });
}
