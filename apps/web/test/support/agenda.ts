import type { CalendarOptions } from '@fullcalendar/core';
import { defineComponent, h, watchEffect } from 'vue';
import type { Appointment, ServiceReport } from '~/utils/agenda';
import { IMAGE } from './shop';

/** Visits of the agenda as the API answers them (packages/contracts/openapi.json). */

export const report = (overrides: Partial<ServiceReport> = {}): ServiceReport => ({
  status: 'SUBMITTED',
  defectFound: true,
  defectDescription: 'Relé de partida queimado.',
  repairDescription: 'Troca do relé de partida.',
  submittedAt: '2026-10-07T14:00:00.000Z',
  amountCents: null,
  reworkComment: null,
  approvedAt: null,
  photos: [{ ...IMAGE, id: 7 }],
  ...overrides,
});

export const appointment = (
  overrides: Partial<Omit<Appointment, 'request'>> & { request?: Partial<Appointment['request']> } = {},
): Appointment => {
  const { request, ...rest } = overrides;
  return {
    id: 9,
    startsAt: '2026-10-07T11:00:00.000Z',
    endsAt: '2026-10-07T13:00:00.000Z',
    version: 1,
    employee: { id: 3, name: 'Tiago Técnico' },
    report: null,
    ...rest,
    request: {
      id: 41,
      status: 'SCHEDULED',
      statusLabel: 'Agendado',
      serviceType: 'Conserto de geladeira',
      productKind: 'Geladeira duplex',
      brand: 'Brastemp',
      model: null,
      problem: 'Não gela embaixo desde ontem.',
      customer: { id: 4, name: 'Carla Cliente', phone: '19999998888' },
      address: {
        street: 'Rua Doutor Ulhoa Cintra',
        number: '91',
        complement: null,
        district: 'Centro',
        city: 'Mogi Mirim',
        state: 'SP',
        cep: '13800061',
      },
      ...request,
    },
  };
};

export const availability = (
  busy: Array<{ appointmentId: number; startsAt: string; endsAt: string }> = [],
) => ({
  body: [
    { employee: { id: 3, name: 'Tiago Técnico' }, busy },
    { employee: { id: 5, name: 'Bruno Técnico' }, busy: [] },
  ],
});

/** Options the agenda handed to FullCalendar the last time it rendered. */
export const calendar: { options: CalendarOptions | null } = { options: null };

/** Stands in for @fullcalendar/vue3, which needs a real layout engine: records the options it receives. */
export const FullCalendarStub = defineComponent({
  props: { options: { type: Object, required: true } },
  setup(props) {
    watchEffect(() => {
      calendar.options = props.options as CalendarOptions;
    });
    return () => h('div', { 'data-testid': 'fullcalendar' });
  },
});

type Handler = (arg: unknown) => void;
const handler = (name: keyof CalendarOptions) => calendar.options![name] as Handler;

/** Simulates FullCalendar showing the week starting on `day` (UTC dates holding the store wall clock). */
export function showWeek(day: string): void {
  const start = new Date(`${day}T00:00:00Z`);
  handler('datesSet')({ start, end: new Date(start.getTime() + 7 * 86_400_000) });
}

export function clickEvent(id: number): void {
  handler('eventClick')({ event: { id: String(id) }, jsEvent: { preventDefault: () => undefined } });
}

/** Drops an event at a new store wall clock time, for example "2026-10-08T09:00:00". */
export function dropEvent(id: number, start: string, end: string, revert: () => void): void {
  handler('eventDrop')({
    event: { id: String(id), start: new Date(`${start}Z`), end: new Date(`${end}Z`) },
    revert,
  });
}

/** Resizes the test window, for the phone, tablet and desktop layouts. */
export function resizeTo(width: number): void {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
  window.dispatchEvent(new Event('resize'));
}
