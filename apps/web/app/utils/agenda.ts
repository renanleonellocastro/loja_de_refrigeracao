import type { ApiSchemas } from '@rc/contracts';
import { formatAddress } from './address';

/** Agenda of the technicians (UCs Consultar Agenda, Cadastrar, Alterar e Excluir Serviço na Agenda). */

export type Appointment = ApiSchemas['Appointment'];
export type ServiceReport = NonNullable<Appointment['report']>;
export type AppointmentAddress = Appointment['request']['address'];
export interface Person {
  id: number;
  name: string;
}
export interface BusyInterval {
  appointmentId: number;
  startsAt: string;
  endsAt: string;
}
export interface Availability {
  employee: Person;
  busy: BusyInterval[];
}

/** Every time on screen is in the store time zone, whatever the time zone of the device. */
export const STORE_TIME_ZONE = 'America/Sao_Paulo';
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
/** The API answers at most 62 days of agenda per call. */
export const MAX_RANGE_DAYS = 62;
export const MAX_REPORT_PHOTOS = 8;

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: STORE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Wall clock of an instant in the store, as "2026-10-07T08:00:00" (no offset). */
export function toStoreWall(instant: string | Date): string {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

/** Instant of a wall clock time in the store ("2026-10-07T08:00") as an ISO string in UTC. */
export function fromStoreWall(wall: string): string {
  const normalized = wall.length === 16 ? `${wall}:00` : wall.slice(0, 19);
  const guess = Date.parse(`${normalized}Z`);
  const offset = Date.parse(`${toStoreWall(new Date(guess))}Z`) - guess;
  return new Date(guess - offset).toISOString();
}

/** Calendar day in the store, as YYYY-MM-DD. */
export function storeDay(instant: string | Date = new Date()): string {
  return toStoreWall(instant).slice(0, 10);
}

/** Time in the store, as HH:mm. */
export function storeTime(instant: string | Date): string {
  return toStoreWall(instant).slice(11, 16);
}

export function addDays(day: string, amount: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + amount * DAY).toISOString().slice(0, 10);
}

/** Start and end instants of whole store days, for the agenda queries. */
export function dayRange(firstDay: string, lastDay = firstDay): { from: string; to: string } {
  return { from: fromStoreWall(`${firstDay}T00:00`), to: fromStoreWall(`${addDays(lastDay, 1)}T00:00`) };
}

const longDay = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

/** "terça-feira, 7 de outubro". */
export function formatLongDay(day: string): string {
  return longDay.format(new Date(`${day}T12:00:00Z`));
}

/** "08:00 às 10:00" in the store time zone. */
export function formatTimeRange(startsAt: string, endsAt: string): string {
  return `${storeTime(startsAt)} às ${storeTime(endsAt)}`;
}

export function durationOf(appointment: { startsAt: string; endsAt: string }): number {
  return Math.round((Date.parse(appointment.endsAt) - Date.parse(appointment.startsAt)) / MINUTE);
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * MINUTE).toISOString();
}

/** Durations offered when scheduling, from 30 minutes to 8 hours. */
export const DURATION_OPTIONS = [30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480];

/** Colors of the technicians: dark enough for white text in both themes (4.5:1 or more). */
export const TECHNICIAN_COLORS = [
  '#184E86',
  '#0F766E',
  '#7C3AED',
  '#B45309',
  '#BE123C',
  '#15803D',
  '#4338CA',
  '#A21CAF',
] as const;

export function technicianColor(employeeId: number): string {
  return TECHNICIAN_COLORS[employeeId % TECHNICIAN_COLORS.length]!;
}

export function appliance(request: Appointment['request']): string {
  return [request.productKind, request.brand, request.model].filter(Boolean).join(' · ');
}

export function appointmentAddress(address: AppointmentAddress): string {
  return formatAddress(address);
}

/** Route on the phone map app; Google Maps opens the native app when it is installed. */
export function mapsUrl(address: AppointmentAddress): string {
  const query = `${address.street}, ${address.number}, ${address.district}, ${address.city} ${address.state}, ${address.cep}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

/** Event of the branded calendar: wall clock times in the store, which the calendar shows as UTC. */
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  editable: boolean;
}

/** Visits waiting for the technician can move; finished ones stay where they happened. */
export function isMovable(appointment: Appointment): boolean {
  return appointment.request.status === 'SCHEDULED' && appointment.report?.status !== 'SUBMITTED';
}

export function toCalendarEvent(appointment: Appointment, withTechnician: boolean): CalendarEvent {
  const color = technicianColor(appointment.employee.id);
  const subject = `${appointment.request.serviceType}: ${appointment.request.customer.name}`;
  return {
    id: String(appointment.id),
    title: withTechnician ? `${appointment.employee.name.split(' ')[0]} · ${subject}` : subject,
    start: toStoreWall(appointment.startsAt),
    end: toStoreWall(appointment.endsAt),
    backgroundColor: color,
    borderColor: color,
    textColor: '#FFFFFF',
    editable: isMovable(appointment),
  };
}

export const REPORT_STATUS_LABELS: Record<ServiceReport['status'], string> = {
  SUBMITTED: 'Aguardando aprovação',
  APPROVED: 'Aprovado',
  REWORK: 'Devolvido para ajuste',
};

/** Weak ETag of a version, as the API sends it (apps/api/src/shared/concurrency.ts). */
export function etagOf(version: number): string {
  return `W/"${version}"`;
}

/** Report typed by the technician, kept on the device until the API accepts it. */
export type ReportDraft = {
  defectFound: 'sim' | 'nao' | '';
  defectDescription: string;
  repairDescription: string;
};

const draftKey = (appointmentId: number) => `rc:finalizacao:${appointmentId}`;

export function loadDraft(appointmentId: number): ReportDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(appointmentId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<ReportDraft>;
    return {
      defectFound: draft.defectFound === 'sim' || draft.defectFound === 'nao' ? draft.defectFound : '',
      defectDescription: String(draft.defectDescription ?? ''),
      repairDescription: String(draft.repairDescription ?? ''),
    };
  } catch {
    return null;
  }
}

export function saveDraft(appointmentId: number, draft: ReportDraft): void {
  try {
    localStorage.setItem(draftKey(appointmentId), JSON.stringify(draft));
  } catch {
    // Private windows and full storage only lose the draft; the form keeps working.
  }
}

export function clearDraft(appointmentId: number): void {
  try {
    localStorage.removeItem(draftKey(appointmentId));
  } catch {
    // Nothing to clean when storage is blocked.
  }
}
