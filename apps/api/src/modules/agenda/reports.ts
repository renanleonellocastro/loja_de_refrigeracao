import type { AppContext } from '../../context.js';
import { conflict, forbidden, unprocessable } from '../../shared/errors.js';
import { formatMoney } from '../../shared/format.js';
import type { AccessClaims } from '../auth/service.js';
import { storeImage } from '../media/service.js';
import * as services from '../services/service.js';
import { getAppointment } from './agenda.js';
import { notifyCustomer, notifyEmployee, notifyManagementOfReport } from './agenda-notices.js';
import { auditAppointment, type AgendaStep, type AuditedAgendaStep } from './appointment-audit.js';
import { loadAppointment, transitionOrFail, type AppointmentDetails } from './appointment-rules.js';
import * as repo from './repository.js';

export const MAX_REPORT_PHOTOS = 8;

const REPORT_MEDIA = 'SERVICE_REPORT';

export interface ReportInput {
  readonly defectFound: boolean;
  readonly defectDescription?: string | undefined;
  readonly repairDescription: string;
}

/** Moves the request of the appointment along with its report. */
async function moveRequest(
  step: AgendaStep,
  row: AppointmentDetails,
  status: services.RequestStatus,
  at: Date,
) {
  await services.updateRequest(step.tx, row.request.id, { status, updatedAt: at });
}

function saveSubmittedReport(step: AgendaStep, id: number, input: ReportInput, submittedAt: Date) {
  return repo.saveReport(step.tx, id, {
    defectFound: input.defectFound,
    defectDescription: input.defectFound ? input.defectDescription! : null,
    repairDescription: input.repairDescription,
    submittedAt,
  });
}

function announceSubmittedReport(step: AgendaStep, row: AppointmentDetails, input: ReportInput) {
  return notifyManagementOfReport(step.ctx, step.tx, row.appointment.id, {
    subject: `Serviço finalizado: solicitação nº ${row.request.id}`,
    paragraphs: [
      `${row.employee.name} finalizou ${row.serviceType.toLowerCase()} (${row.request.productKind}).`,
      input.repairDescription,
    ],
  });
}

async function submit(step: AgendaStep, id: number, input: ReportInput) {
  const row = await loadAppointment(step.tx, step.actor, id);
  if (row.appointment.employeeId !== step.actor.userId)
    throw forbidden('Só o técnico do atendimento pode finalizar.');
  const status = transitionOrFail(row.request.status, 'submitReport');
  const now = step.ctx.clock.now();
  const report = await saveSubmittedReport(step, id, input, now);
  await moveRequest(step, row, status, now);
  await announceSubmittedReport(step, row, input);
  return report;
}

/** UC Finalizar Serviço: only the assigned technician; also used to resubmit after a rework request. */
export async function submitReport(ctx: AppContext, actor: AccessClaims, id: number, input: ReportInput) {
  return ctx.db.transaction((tx) => submit({ ctx, tx, actor }, id, input));
}

async function openReportOrFail(ctx: AppContext, actor: AccessClaims, id: number) {
  const { report } = await loadAppointment(ctx.db, actor, id);
  if (!report || report.status === 'APPROVED') {
    throw conflict(
      'report-required',
      'Finalize o serviço primeiro',
      'Envie as fotos depois de preencher a finalização.',
    );
  }
  return report;
}

async function assertRoomForPhotos(ctx: AppContext, reportId: number, count: number) {
  const existing = await services.listMedia(ctx.db, REPORT_MEDIA, reportId);
  if (existing.length + count > MAX_REPORT_PHOTOS) {
    throw unprocessable(
      'too-many-photos',
      'Fotos demais',
      `Cada finalização aceita até ${MAX_REPORT_PHOTOS} fotos.`,
    );
  }
}

export async function addReportPhotos(ctx: AppContext, actor: AccessClaims, id: number, files: Buffer[]) {
  const report = await openReportOrFail(ctx, actor, id);
  await assertRoomForPhotos(ctx, report.id, files.length);
  for (const file of files) {
    await services.insertMedia(ctx.db, REPORT_MEDIA, report.id, await storeImage(ctx.storage, file));
  }
  return getAppointment(ctx, actor, id);
}

function completionSummary(row: AppointmentDetails, report: repo.ReportRow, amountCents: number): string[] {
  return [
    `${row.serviceType} (${row.request.productKind}) foi concluído por ${row.employee.name}.`,
    report.defectFound ? `Defeito encontrado: ${report.defectDescription}` : 'Nenhum defeito encontrado.',
    `O que foi feito: ${report.repairDescription}`,
    `Valor do serviço: ${formatMoney(amountCents)}.`,
    'Obrigado pela confiança!',
  ];
}

function markApproved(step: AgendaStep, id: number, amountCents: number, approvedAt: Date) {
  return repo.updateReport(step.tx, id, {
    status: 'APPROVED',
    amountCents,
    approvedById: step.actor.userId,
    approvedAt,
  });
}

function announceCompletion(
  step: AgendaStep,
  row: AppointmentDetails,
  report: repo.ReportRow,
  amountCents: number,
) {
  return notifyCustomer(step.ctx, step.tx, row.request, {
    subject: `Serviço concluído: solicitação nº ${row.request.id}`,
    heading: 'Serviço concluído',
    paragraphs: completionSummary(row, report, amountCents),
  });
}

async function approve(step: AuditedAgendaStep, id: number, amountCents: number) {
  const row = await loadAppointment(step.tx, step.actor, id);
  const status = transitionOrFail(row.request.status, 'approveReport');
  const approvedAt = step.ctx.clock.now();
  const report = await markApproved(step, id, amountCents, approvedAt);
  await moveRequest(step, row, status, approvedAt);
  await announceCompletion(step, row, report, amountCents);
  await auditAppointment(step, { action: 'serviceReport.approve', id, after: report });
  return report;
}

/** UC Aprovar Finalização: the value of the service is set and the customer receives the summary. */
export async function approveReport(
  ctx: AppContext,
  actor: AccessClaims,
  id: number,
  amountCents: number,
  ip: string,
) {
  return ctx.db.transaction((tx) => approve({ ctx, tx, actor, ip }, id, amountCents));
}

async function returnForRework(step: AuditedAgendaStep, id: number, comment: string) {
  const row = await loadAppointment(step.tx, step.actor, id);
  const status = transitionOrFail(row.request.status, 'requestRework');
  const report = await repo.updateReport(step.tx, id, { status: 'REWORK', reworkComment: comment });
  await moveRequest(step, row, status, step.ctx.clock.now());
  await notifyEmployee(step.ctx, step.tx, {
    employeeId: row.appointment.employeeId,
    appointmentId: id,
    subject: 'Ajuste pedido na finalização',
    paragraphs: [comment],
  });
  await auditAppointment(step, { action: 'serviceReport.rework', id, after: report });
  return report;
}

export async function requestRework(
  ctx: AppContext,
  actor: AccessClaims,
  id: number,
  comment: string,
  ip: string,
) {
  return ctx.db.transaction((tx) => returnForRework({ ctx, tx, actor, ip }, id, comment));
}
