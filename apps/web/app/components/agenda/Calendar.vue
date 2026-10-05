<script setup lang="ts">
import type { CalendarOptions, DatesSetArg, EventClickArg, EventDropArg } from '@fullcalendar/core';
import ptBrLocale from '@fullcalendar/core/locales/pt-br';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import FullCalendar from '@fullcalendar/vue3';
import { fromStoreWall, toStoreWall, type CalendarEvent } from '~/utils/agenda';

/**
 * Branded FullCalendar (ADR 0014, MIT plugins only). Events come as wall clock times in the store and the
 * calendar runs in UTC, so every device shows São Paulo time without a time zone plugin.
 */
export type CalendarView = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';

const props = withDefaults(
  defineProps<{
    events: CalendarEvent[];
    views: CalendarView[];
    /** Allows moving events by drag and drop (desktop, management). */
    editable?: boolean;
  }>(),
  { editable: false },
);

const emit = defineEmits<{
  /** Visible period changed: instants of its first and last moment. */
  range: [range: { from: string; to: string }];
  open: [id: number];
  move: [change: { id: number; startsAt: string; endsAt: string; revert: () => void }];
}>();

/** Calendar dates are UTC dates holding the store wall clock. */
const toInstant = (date: Date) => fromStoreWall(date.toISOString().slice(0, 19));

function moved(info: EventDropArg): void {
  emit('move', {
    id: Number(info.event.id),
    startsAt: toInstant(info.event.start!),
    endsAt: toInstant(info.event.end!),
    revert: info.revert,
  });
}

const options = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
  locale: ptBrLocale,
  timeZone: 'UTC',
  now: () => toStoreWall(new Date()),
  initialView: props.views[0],
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: props.views.length > 1 ? props.views.join(',') : '',
  },
  // Text buttons: the icon font spans have role img without a name, which screen readers announce badly.
  buttonIcons: false,
  buttonText: {
    prev: 'Anterior',
    next: 'Próximo',
    today: 'Hoje',
    month: 'Mês',
    week: 'Semana',
    day: 'Dia',
    list: 'Lista',
  },
  height: 'auto',
  allDaySlot: false,
  slotMinTime: '07:00:00',
  slotMaxTime: '20:00:00',
  scrollTime: '07:00:00',
  nowIndicator: true,
  eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
  slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
  editable: props.editable,
  eventDurationEditable: false,
  events: props.events,
  noEventsContent: 'Nenhum atendimento neste período.',
  datesSet: (info: DatesSetArg) => emit('range', { from: toInstant(info.start), to: toInstant(info.end) }),
  eventClick: (info: EventClickArg) => {
    info.jsEvent.preventDefault();
    emit('open', Number(info.event.id));
  },
  eventDrop: moved,
}));
</script>

<template>
  <div class="rc-calendar rounded-xl border border-border bg-surface p-3 md:p-4">
    <FullCalendar :options="options" />
  </div>
</template>

<style>
.rc-calendar {
  --fc-border-color: var(--color-border);
  --fc-page-bg-color: var(--color-surface);
  --fc-neutral-bg-color: var(--color-surface-sunken);
  --fc-list-event-hover-bg-color: var(--color-surface-sunken);
  --fc-today-bg-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
  --fc-now-indicator-color: var(--color-danger);
  --fc-button-bg-color: var(--color-surface);
  --fc-button-border-color: var(--color-border-strong);
  --fc-button-text-color: var(--color-text);
  --fc-button-hover-bg-color: var(--color-surface-sunken);
  --fc-button-hover-border-color: var(--color-border-strong);
  --fc-button-active-bg-color: var(--color-primary);
  --fc-button-active-border-color: var(--color-primary);
  color: var(--color-text);
}
.rc-calendar .fc .fc-toolbar-title {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 800;
}
.rc-calendar .fc .fc-button {
  min-height: 2.75rem;
  border-radius: 0.5rem;
  font-weight: 600;
  text-transform: capitalize;
}
.rc-calendar .fc .fc-button-primary:not(:disabled).fc-button-active {
  color: var(--color-on-primary);
}
.rc-calendar .fc .fc-col-header-cell-cushion,
.rc-calendar .fc .fc-daygrid-day-number,
.rc-calendar .fc .fc-list-day-text,
.rc-calendar .fc .fc-list-day-side-text {
  color: var(--color-text);
  text-transform: capitalize;
}
.rc-calendar .fc .fc-event {
  cursor: pointer;
  border-radius: 0.375rem;
  font-weight: 600;
}
.rc-calendar .fc .fc-list-event-title a,
.rc-calendar .fc .fc-list-event-time {
  color: var(--color-text);
}
</style>
