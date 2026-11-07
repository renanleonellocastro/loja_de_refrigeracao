import { mountSuspended } from '@nuxt/test-utils/runtime';
import { describe, expect, it, vi } from 'vitest';
import Calendar from '~/components/agenda/Calendar.vue';
import { calendar } from '../support/agenda';

vi.mock('@fullcalendar/vue3', async () => ({
  default: (await import('../support/agenda')).FullCalendarStub,
}));

type Fn = (arg: unknown) => string;
const option = (name: string) => (calendar.options as Record<string, unknown>)[name] as Fn;

describe('agenda calendar options', () => {
  it('names the toolbar buttons in Portuguese and starts with the visible text', async () => {
    await mountSuspended(Calendar, { props: { views: ['timeGridWeek'], events: [], editable: false } });
    expect(option('prevHint')('Semana')).toBe('Anterior: semana');
    expect(option('nextHint')('Semana')).toBe('Próximo: semana');
    expect(option('viewHint')('Mês')).toBe('Mês');
  });

  it('adds the brand class hooks to buttons and views', async () => {
    await mountSuspended(Calendar, { props: { views: ['timeGridWeek'], events: [], editable: false } });
    expect(option('buttonClass')({ isSelected: true })).toBe('rc-fc-button rc-fc-button-selected');
    expect(option('buttonClass')({ isSelected: false })).toBe('rc-fc-button');
    expect(option('viewClass')({ view: { type: 'listWeek' } })).toBe('rc-fc-view rc-fc-listWeek');
  });

  it('gives FullCalendar the store wall clock as now', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-06T15:00:00Z'), toFake: ['Date'] });
    await mountSuspended(Calendar, { props: { views: ['timeGridWeek'], events: [], editable: false } });
    expect((option('now') as unknown as () => string)()).toBe('2026-11-06T12:00:00');
    vi.useRealTimers();
  });
});
