import type { ApiSchemas } from '@rc/contracts';
import { formatDateTime } from './masks';
import { statusMeta, type ServiceRequestStatus } from './status';
import type { TimelineEvent } from './types';

export type ServiceType = ApiSchemas['ServiceType'];
export type ServiceRequest = ApiSchemas['ServiceRequest'];
export type ServiceRequestListItem = ApiSchemas['ServiceRequestListItem'];
export type RequestMessage = ApiSchemas['Message'];
export type VisitPeriod = 'MORNING' | 'AFTERNOON';
export interface VisitWindow {
  day: string;
  period: VisitPeriod;
}

/** Limits of the API (apps/api services module): windows from tomorrow up to 60 days ahead, 10 at most. */
export const MAX_WINDOW_DAYS_AHEAD = 60;
export const MAX_WINDOWS = 10;
export const MAX_REQUEST_PHOTOS = 6;
export const REQUESTS_PAGE_SIZE = 20;

export const PERIOD_LABELS: Record<VisitPeriod, string> = {
  MORNING: 'Manhã, das 8h às 12h',
  AFTERNOON: 'Tarde, das 13h às 18h',
};

/** Requests still waiting for a decision of the store. */
export function isOpenRequest(status: ServiceRequestStatus): boolean {
  return status === 'REQUESTED' || status === 'AWAITING_CUSTOMER';
}

/** The conversation stays open until the request ends. */
export function canTalk(status: ServiceRequestStatus): boolean {
  return !['COMPLETED', 'REJECTED', 'CANCELED'].includes(status);
}

const ILLUSTRATIONS: ReadonlyArray<[RegExp, string]> = [
  [/instala/, 'servico-instalacao-ar'],
  [/ar condicionado|split/, 'servico-ar-condicionado'],
  [/freezer/, 'servico-freezer'],
  [/lavadora|lava e seca/, 'servico-lavadora'],
  [/bebedouro|purificador/, 'servico-bebedouro'],
  [/comercia|balc|camara/, 'servico-refrigeracao-comercial'],
];

/** Illustration of a service type, picked by its name; refrigerators are the default. */
export function serviceIllustration(name: string): string {
  const key = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const found = ILLUSTRATIONS.find(([pattern]) => pattern.test(key));
  return `/illustrations/${found ? found[1] : 'servico-geladeira'}.svg`;
}

/** Estimated duration as text: "1h30", "2h" or "45 min". */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)}h${rest ? String(rest).padStart(2, '0') : ''}`;
}

function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Days a visit can be asked for: from tomorrow up to 60 days ahead, as YYYY-MM-DD. */
export function availableDays(now: Date = new Date()): string[] {
  return Array.from({ length: MAX_WINDOW_DAYS_AHEAD }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + index + 1);
    return isoDay(date);
  });
}

const dayFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

/** A calendar day as "segunda-feira, 06/10/2026". */
export function formatDay(day: string): string {
  return dayFormatter.format(new Date(`${day}T12:00:00Z`));
}

export function formatWindow(window: VisitWindow): string {
  return `${formatDay(window.day)}, ${PERIOD_LABELS[window.period].toLowerCase()}`;
}

/** Windows in calendar order, morning before afternoon. */
export function sortWindows<T extends VisitWindow>(windows: readonly T[]): T[] {
  return [...windows].sort((a, b) =>
    `${a.day}${a.period === 'MORNING' ? 0 : 1}`.localeCompare(`${b.day}${b.period === 'MORNING' ? 0 : 1}`),
  );
}

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

/** Visit time of a scheduled request: "06/10/2026, 08:00 até 10:00". */
export function formatVisit(appointment: { startsAt: string; endsAt: string }): string {
  return `${formatDateTime(appointment.startsAt)} até ${timeFormatter.format(new Date(appointment.endsAt))}`;
}

/** Short history for BaseTimeline, newest first: the request and its current state. */
export function requestTimeline(request: ServiceRequest): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: 'created',
      title: 'Solicitação enviada',
      when: formatDateTime(request.createdAt),
      datetime: request.createdAt,
      icon: statusMeta('serviceRequest', 'REQUESTED').icon,
    },
  ];
  if (request.status !== 'REQUESTED') {
    events.push({
      id: 'current',
      title: statusMeta('serviceRequest', request.status).label,
      when: formatDateTime(request.updatedAt),
      datetime: request.updatedAt,
      description: request.rejectionReason ?? request.cancellationReason ?? undefined,
      icon: statusMeta('serviceRequest', request.status).icon,
    });
  }
  return events.reverse();
}

/** What happens next, in the words of the counter, for each status of a request (customer view). */
export const REQUEST_NEXT_STEP: Record<ServiceRequestStatus, string> = {
  REQUESTED: 'A loja está analisando seu pedido de visita. A gente responde em até 1 dia útil.',
  AWAITING_CUSTOMER: 'A loja fez uma pergunta. Responda na conversa abaixo para seguir com o agendamento.',
  APPROVED: 'Pedido aprovado! Agora a loja escolhe o técnico e confirma a data da visita.',
  SCHEDULED: 'Visita agendada. O técnico vai até você no horário abaixo.',
  AWAITING_COMPLETION_APPROVAL: 'O técnico registrou o serviço. A loja está conferindo o relatório.',
  COMPLETED: 'Serviço concluído. Obrigado pela confiança!',
  REJECTED: 'A loja não pode atender este pedido. Veja o motivo abaixo.',
  CANCELED: 'Este agendamento foi cancelado.',
};

/** The API rule for customers: a scheduled visit can be canceled on the site until 18:00 of the day before. */
export const CANCEL_RULE =
  'Você pode cancelar pelo site até as 18h do dia anterior à visita. Depois disso, ligue para a loja.';
