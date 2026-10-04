import type { AppContext } from '../../context.js';
import type { Executor } from '../../infra/db/client.js';
import { HOUR, MINUTE } from '../../shared/clock.js';
import { assertIfMatch } from '../../shared/concurrency.js';
import { conflict, forbidden, notFound, unprocessable } from '../../shared/errors.js';
import { formatDateTime, formatMoney, formatTimeRange } from '../../shared/format.js';
import { recordAudit } from '../audit/service.js';
import type { AccessClaims } from '../auth/service.js';
import * as notifications from '../notifications/service.js';
import { imageView, storeImage } from '../media/service.js';
import * as services from '../services/service.js';
import * as users from '../users/service.js';
import * as repo from './repository.js';

export const MAX_REPORT_PHOTOS = 8;
const MAX_DURATION = 12 * HOUR;

type Join = NonNullable<repo.AppointmentJoin>;

function toView(
  row: Join,
  photos: Array<{ id: number; storageKey: string; width: number; height: number }> = [],
) {
  const { appointment, request, report } = row;
  return {
    id: appointment.id,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    version: appointment.version,
    employee: row.employee,
    request: {
      id: request.id,
      status: request.status,
      statusLabel: services.REQUEST_STATUS_LABELS[request.status],
      serviceType: row.serviceType,
      productKind: request.productKind,
      brand: request.brand,
      model: request.model,
      problem: request.problem,
      customer: row.customer.deletedAt
        ? { id: row.customer.id, name: 'Conta removida', phone: null }
        : { id: row.customer.id, name: row.customer.name, phone: row.customer.phone },
      address: request.address,
    },
    report: report
      ? {
          status: report.status,
          defectFound: report.defectFound,
          defectDescription: report.defectDescription,
          repairDescription: report.repairDescription,
          submittedAt: report.submittedAt,
          amountCents: report.amountCents,
          reworkComment: report.reworkComment,
          approvedAt: report.approvedAt,
          photos: photos.map((p) => ({
            id: p.id,
            ...imageView({ key: p.storageKey, width: p.width, height: p.height }),
          })),
        }
      : null,
  };
}

async function loadJoin(db: Executor, viewer: AccessClaims, id: number): Promise<Join> {
  const row = await repo.findAppointmentJoin(db, id);
  if (!row || (viewer.role === 'EMPLOYEE' && row.appointment.employeeId !== viewer.userId)) {
    throw notFound('Agendamento não encontrado.');
  }
  return row;
}

export async function getAppointment(ctx: AppContext, viewer: AccessClaims, id: number) {
  const row = await loadJoin(ctx.db, viewer, id);
  const photos = row.report ? await services.listMedia(ctx.db, 'SERVICE_REPORT', row.report.id) : [];
  return toView(row, photos);
}

/** Agenda in a time range: the technician sees their own, management sees everyone (or one technician). */
export async function listAgenda(
  ctx: AppContext,
  viewer: AccessClaims,
  query: { from: Date; to: Date; employeeId?: number | undefined },
) {
  const employeeId = viewer.role === 'EMPLOYEE' ? viewer.userId : query.employeeId;
  const rows = await repo.listAppointmentsInRange(ctx.db, query.from, query.to, employeeId);
  return rows.map((row) => toView(row));
}

export async function availability(ctx: AppContext, from: Date, to: Date) {
  const employees = await repo.activeEmployees(ctx.db);
  const busy = await repo.busyIntervals(
    ctx.db,
    employees.map((e) => e.id),
    from,
    to,
  );
  return employees.map((employee) => ({
    employee,
    busy: busy
      .filter((b) => b.employeeId === employee.id)
      .map((b) => ({ appointmentId: b.id, startsAt: b.startsAt, endsAt: b.endsAt })),
  }));
}

function validateInterval(startsAt: Date, endsAt: Date, now: Date) {
  const fail = (path: string, message: string) => {
    throw unprocessable('invalid-time', 'Horário inválido', message, { errors: [{ path, message }] });
  };
  if (startsAt.getTime() < now.getTime() - 5 * MINUTE) fail('startsAt', 'Escolha um horário futuro.');
  if (endsAt <= startsAt) fail('endsAt', 'O fim deve ser depois do início.');
  if (endsAt.getTime() - startsAt.getTime() > MAX_DURATION)
    fail('endsAt', 'Um atendimento dura no máximo 12 horas.');
}

async function assertEmployee(db: Executor, employeeId: number) {
  const employee = await users.findActiveUserById(db, employeeId);
  if (!employee || employee.role !== 'EMPLOYEE') {
    throw unprocessable('invalid-employee', 'Colaborador inválido', 'Escolha um colaborador ativo.', {
      errors: [{ path: 'employeeId', message: 'Escolha um colaborador ativo.' }],
    });
  }
  return employee;
}

async function assertFree(db: Executor, employeeId: number, startsAt: Date, endsAt: Date, exceptId?: number) {
  const overlap = await repo.findOverlap(db, employeeId, startsAt, endsAt, exceptId);
  if (overlap) {
    throw conflict(
      'schedule-conflict',
      'Horário ocupado',
      `O colaborador já tem um atendimento das ${formatTimeRange(overlap.startsAt, overlap.endsAt)}.`,
      {
        conflictingAppointmentId: overlap.id,
      },
    );
  }
}

/** The overlap check runs first for a clear message; the database constraint still guards concurrent writes. */
export function mapOverlapViolation(error: unknown): never {
  const code =
    (error as { code?: string; cause?: { code?: string } }).cause?.code ?? (error as { code?: string }).code;
  if (code === '23P01') {
    throw conflict(
      'schedule-conflict',
      'Horário ocupado',
      'Outra pessoa acabou de agendar este horário. Escolha outro.',
    );
  }
  throw error;
}

function notifyCustomer(
  ctx: AppContext,
  db: Executor,
  request: services.RequestRow,
  subject: string,
  heading: string,
  paragraphs: string[],
) {
  return notifications.notifyUserById(ctx, db, request.customerId, {
    type: 'appointment',
    subject,
    heading,
    paragraphs,
    path: `/minha-conta/agendamentos/${request.id}`,
    actionLabel: 'Ver meu agendamento',
  });
}

function notifyEmployee(
  ctx: AppContext,
  db: Executor,
  employeeId: number,
  appointmentId: number,
  subject: string,
  paragraphs: string[],
) {
  return notifications.notifyUserById(ctx, db, employeeId, {
    type: 'appointment',
    subject,
    paragraphs,
    path: `/agenda/${appointmentId}`,
    actionLabel: 'Abrir na agenda',
  });
}

function transitionOrFail(status: services.RequestStatus, action: services.RequestAction) {
  const next = services.nextRequestStatus(status, action, 'staff');
  if (next === null) {
    throw conflict(
      'invalid-transition',
      'Ação indisponível',
      `A solicitação está ${services.REQUEST_STATUS_LABELS[status].toLowerCase()}.`,
    );
  }
  return next;
}

/** UC Cadastrar Serviço na Agenda do Colaborador. */
export async function scheduleAppointment(
  ctx: AppContext,
  actor: AccessClaims,
  input: { serviceRequestId: number; employeeId: number; startsAt: Date; endsAt?: Date | undefined },
  ip: string,
) {
  try {
    return await ctx.db.transaction(async (tx) => {
      const request = await services.findRequest(tx, input.serviceRequestId);
      if (!request) throw notFound('Solicitação não encontrada.');
      const status = transitionOrFail(request.status, 'schedule');
      const employee = await assertEmployee(tx, input.employeeId);
      const type = await services.findServiceType(tx, request.serviceTypeId);
      const endsAt = input.endsAt ?? new Date(input.startsAt.getTime() + type!.estimatedMinutes * MINUTE);
      validateInterval(input.startsAt, endsAt, ctx.clock.now());
      await assertFree(tx, employee.id, input.startsAt, endsAt);
      const now = ctx.clock.now();
      const appointment = await repo.insertAppointment(tx, {
        serviceRequestId: request.id,
        employeeId: employee.id,
        startsAt: input.startsAt,
        endsAt,
        createdById: actor.userId,
        createdAt: now,
        updatedAt: now,
      });
      await services.updateRequest(tx, request.id, { status, updatedAt: now });
      const when = `${formatDateTime(input.startsAt)} (${formatTimeRange(input.startsAt, endsAt)})`;
      await notifyCustomer(
        ctx,
        tx,
        request,
        `Visita confirmada: solicitação nº ${request.id}`,
        'Visita confirmada',
        [
          `Nosso técnico ${employee.name} vai até você em ${when}.`,
          'Se precisar remarcar, fale com a loja até as 18h do dia anterior.',
        ],
      );
      await notifyEmployee(ctx, tx, employee.id, appointment.id, 'Novo atendimento na sua agenda', [
        `${type!.name}: ${request.productKind}, ${when}.`,
        `${request.address.street}, ${request.address.number}, ${request.address.district}, ${request.address.city}.`,
      ]);
      await recordAudit(tx, {
        actorId: actor.userId,
        action: 'appointment.create',
        resourceType: 'appointment',
        resourceId: appointment.id,
        after: appointment,
        ip,
      });
      return appointment;
    });
  } catch (error) {
    return mapOverlapViolation(error);
  }
}

/** UC Alterar Serviço na Agenda: requires If-Match with the current version. */
export async function rescheduleAppointment(
  ctx: AppContext,
  actor: AccessClaims,
  id: number,
  ifMatch: string | undefined,
  changes: { employeeId?: number | undefined; startsAt?: Date | undefined; endsAt?: Date | undefined },
  ip: string,
) {
  try {
    return await ctx.db.transaction(async (tx) => {
      const row = await loadJoin(tx, actor, id);
      const before = row.appointment;
      assertIfMatch(ifMatch, before.version);
      if (row.request.status !== 'SCHEDULED') {
        throw conflict(
          'invalid-transition',
          'Ação indisponível',
          'Só é possível alterar atendimentos ainda não finalizados.',
        );
      }
      const employeeId = changes.employeeId ?? before.employeeId;
      if (changes.employeeId !== undefined) await assertEmployee(tx, employeeId);
      const startsAt = changes.startsAt ?? before.startsAt;
      const duration = before.endsAt.getTime() - before.startsAt.getTime();
      const endsAt =
        changes.endsAt ?? (changes.startsAt ? new Date(startsAt.getTime() + duration) : before.endsAt);
      validateInterval(startsAt, endsAt, ctx.clock.now());
      await assertFree(tx, employeeId, startsAt, endsAt, id);
      const after = await repo.updateAppointment(tx, id, {
        employeeId,
        startsAt,
        endsAt,
        version: before.version + 1,
        updatedAt: ctx.clock.now(),
      });
      const when = `${formatDateTime(startsAt)} (${formatTimeRange(startsAt, endsAt)})`;
      await notifyCustomer(
        ctx,
        tx,
        row.request,
        `Visita remarcada: solicitação nº ${row.request.id}`,
        'Visita remarcada',
        [`A nova data é ${when}.`],
      );
      await notifyEmployee(ctx, tx, employeeId, id, 'Atendimento atualizado na sua agenda', [
        `${row.serviceType}: ${when}.`,
      ]);
      if (employeeId !== before.employeeId) {
        await notifyEmployee(ctx, tx, before.employeeId, id, 'Atendimento saiu da sua agenda', [
          `${row.serviceType} de ${formatDateTime(before.startsAt)} foi passado para outro colaborador.`,
        ]);
      }
      await recordAudit(tx, {
        actorId: actor.userId,
        action: 'appointment.update',
        resourceType: 'appointment',
        resourceId: id,
        before,
        after,
        ip,
      });
      return after;
    });
  } catch (error) {
    return mapOverlapViolation(error);
  }
}

/** UC Excluir Serviço da Agenda (super user): the request goes back to approved, waiting for a new date. */
export async function removeAppointment(ctx: AppContext, actor: AccessClaims, id: number, ip: string) {
  await ctx.db.transaction(async (tx) => {
    const row = await loadJoin(tx, actor, id);
    const status = transitionOrFail(row.request.status, 'unschedule');
    await repo.deleteAppointment(tx, id);
    await services.updateRequest(tx, row.request.id, { status, updatedAt: ctx.clock.now() });
    await notifyCustomer(
      ctx,
      tx,
      row.request,
      `Visita desmarcada: solicitação nº ${row.request.id}`,
      'Vamos remarcar sua visita',
      ['A visita marcada foi desmarcada. A loja vai combinar uma nova data com você.'],
    );
    await notifyEmployee(ctx, tx, row.appointment.employeeId, id, 'Atendimento removido da sua agenda', [
      `${row.serviceType} de ${formatDateTime(row.appointment.startsAt)} foi removido.`,
    ]);
    await recordAudit(tx, {
      actorId: actor.userId,
      action: 'appointment.delete',
      resourceType: 'appointment',
      resourceId: id,
      before: row.appointment,
      ip,
    });
  });
}

function notifyManagement(
  ctx: AppContext,
  db: Executor,
  subject: string,
  paragraphs: string[],
  path: string,
) {
  return notifications.notifyManagement(ctx, db, null, {
    type: 'serviceReport',
    subject,
    paragraphs,
    path,
    actionLabel: 'Abrir aprovação',
  });
}

/** UC Finalizar Serviço: only the assigned technician; also used to resubmit after a rework request. */
export async function submitReport(
  ctx: AppContext,
  actor: AccessClaims,
  id: number,
  input: { defectFound: boolean; defectDescription?: string | undefined; repairDescription: string },
) {
  return ctx.db.transaction(async (tx) => {
    const row = await loadJoin(tx, actor, id);
    if (row.appointment.employeeId !== actor.userId)
      throw forbidden('Só o técnico do atendimento pode finalizar.');
    const status = transitionOrFail(row.request.status, 'submitReport');
    const now = ctx.clock.now();
    const report = await repo.saveReport(tx, id, {
      defectFound: input.defectFound,
      defectDescription: input.defectFound ? input.defectDescription! : null,
      repairDescription: input.repairDescription,
      submittedAt: now,
    });
    await services.updateRequest(tx, row.request.id, { status, updatedAt: now });
    await notifyManagement(
      ctx,
      tx,
      `Serviço finalizado: solicitação nº ${row.request.id}`,
      [
        `${row.employee.name} finalizou ${row.serviceType.toLowerCase()} (${row.request.productKind}).`,
        input.repairDescription,
      ],
      `/aprovacoes/${id}`,
    );
    return report;
  });
}

export async function addReportPhotos(ctx: AppContext, actor: AccessClaims, id: number, files: Buffer[]) {
  const row = await loadJoin(ctx.db, actor, id);
  if (!row.report || row.report.status === 'APPROVED') {
    throw conflict(
      'report-required',
      'Finalize o serviço primeiro',
      'Envie as fotos depois de preencher a finalização.',
    );
  }
  const existing = await services.listMedia(ctx.db, 'SERVICE_REPORT', row.report.id);
  if (existing.length + files.length > MAX_REPORT_PHOTOS) {
    throw unprocessable(
      'too-many-photos',
      'Fotos demais',
      `Cada finalização aceita até ${MAX_REPORT_PHOTOS} fotos.`,
    );
  }
  for (const file of files) {
    await services.insertMedia(ctx.db, 'SERVICE_REPORT', row.report.id, await storeImage(ctx.storage, file));
  }
  return getAppointment(ctx, actor, id);
}

/** UC Aprovar Finalização: the value of the service is set and the customer receives the summary. */
export async function approveReport(
  ctx: AppContext,
  actor: AccessClaims,
  id: number,
  amountCents: number,
  ip: string,
) {
  return ctx.db.transaction(async (tx) => {
    const row = await loadJoin(tx, actor, id);
    const status = transitionOrFail(row.request.status, 'approveReport');
    const now = ctx.clock.now();
    const report = await repo.updateReport(tx, id, {
      status: 'APPROVED',
      amountCents,
      approvedById: actor.userId,
      approvedAt: now,
    });
    await services.updateRequest(tx, row.request.id, { status, updatedAt: now });
    await notifyCustomer(
      ctx,
      tx,
      row.request,
      `Serviço concluído: solicitação nº ${row.request.id}`,
      'Serviço concluído',
      [
        `${row.serviceType} (${row.request.productKind}) foi concluído por ${row.employee.name}.`,
        report.defectFound ? `Defeito encontrado: ${report.defectDescription}` : 'Nenhum defeito encontrado.',
        `O que foi feito: ${report.repairDescription}`,
        `Valor do serviço: ${formatMoney(amountCents)}.`,
        'Obrigado pela confiança!',
      ],
    );
    await recordAudit(tx, {
      actorId: actor.userId,
      action: 'serviceReport.approve',
      resourceType: 'appointment',
      resourceId: id,
      after: report,
      ip,
    });
    return report;
  });
}

export async function requestRework(
  ctx: AppContext,
  actor: AccessClaims,
  id: number,
  comment: string,
  ip: string,
) {
  return ctx.db.transaction(async (tx) => {
    const row = await loadJoin(tx, actor, id);
    const status = transitionOrFail(row.request.status, 'requestRework');
    const report = await repo.updateReport(tx, id, { status: 'REWORK', reworkComment: comment });
    await services.updateRequest(tx, row.request.id, { status, updatedAt: ctx.clock.now() });
    await notifyEmployee(ctx, tx, row.appointment.employeeId, id, 'Ajuste pedido na finalização', [comment]);
    await recordAudit(tx, {
      actorId: actor.userId,
      action: 'serviceReport.rework',
      resourceType: 'appointment',
      resourceId: id,
      after: report,
      ip,
    });
    return report;
  });
}
