<script setup lang="ts">
import FullCalendar, {
  type CalendarOptions,
  type DatesSetInfo,
  type EventClickInfo,
  type EventDropInfo,
} from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/vue3/daygrid';
import interactionPlugin from '@fullcalendar/vue3/interaction';
import listPlugin from '@fullcalendar/vue3/list';
import ptBrLocale from '@fullcalendar/vue3/locales/pt-br';
import '@fullcalendar/vue3/skeleton.css';
import classicTheme from '@fullcalendar/vue3/themes/classic';
import '@fullcalendar/vue3/themes/classic/theme.css';
import timeGridPlugin from '@fullcalendar/vue3/timegrid';
import { fromStoreWall, toStoreWall, type CalendarEvent } from '~/utils/agenda';

/**
 * Branded FullCalendar 7 (ADR 0014, MIT plugins only). Events come as wall clock times in the store and
 * the calendar runs in UTC, so every device shows São Paulo time. The classic theme draws the layout and
 * its palette variables are mapped to the design tokens below, so the calendar follows light and dark.
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

function moved(info: EventDropInfo): void {
  emit('move', {
    id: Number(info.event.id),
    startsAt: toInstant(info.event.start!),
    endsAt: toInstant(info.event.end!),
    revert: info.revert,
  });
}

/** Options that never change: plugins, Portuguese labels and the store working hours. */
const STATIC_OPTIONS: CalendarOptions = {
  plugins: [classicTheme, dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
  locale: ptBrLocale,
  timeZone: 'UTC',
  // Text buttons: a word is clearer than a chevron. The pt-br locale names them (Anterior, Próximo, Hoje, Mês,
  // Semana, Dia, Lista); the classic theme draws chevrons on prev and next unless their icon is cleared.
  buttonDisplay: 'text',
  buttons: { prev: { iconContent: null }, next: { iconContent: null } },
  // Spoken names start with the visible text (WCAG 2.5.3, label in name) and fill what pt-br leaves in English.
  prevHint: (unit) => `Anterior: ${unit.toLowerCase()}`,
  nextHint: (unit) => `Próximo: ${unit.toLowerCase()}`,
  todayHint: 'Hoje',
  viewHint: (text) => text,
  viewChangeHint: 'Mudar a visualização',
  timedText: 'Horários',
  // Hooks for the brand styles below and for the E2E specs: FullCalendar 7 renders no fc-* class names.
  toolbarTitleClass: 'rc-fc-title',
  buttonClass: ({ isSelected }) => (isSelected ? 'rc-fc-button rc-fc-button-selected' : 'rc-fc-button'),
  viewClass: ({ view }) => `rc-fc-view rc-fc-${view.type}`,
  eventClass: 'rc-fc-event',
  dayHeaderInnerClass: 'rc-fc-capitalize',
  listDayHeaderInnerClass: 'rc-fc-capitalize',
  height: 'auto',
  allDaySlot: false,
  slotMinTime: '07:00:00',
  slotMaxTime: '20:00:00',
  scrollTime: '07:00:00',
  nowIndicator: true,
  // A stable function: FullCalendar 7 treats a new one as a changed option and goes back to today.
  now: () => toStoreWall(new Date()),
  eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
  slotHeaderFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
  eventDurationEditable: false,
  noEventsContent: 'Nenhum atendimento neste período.',
};

function rangeChanged(info: DatesSetInfo): void {
  emit('range', { from: toInstant(info.start), to: toInstant(info.end) });
}

function opened(info: EventClickInfo): void {
  info.jsEvent.preventDefault();
  emit('open', Number(info.event.id));
}

function headerToolbar(views: CalendarView[]): CalendarOptions['headerToolbar'] {
  return { left: 'prev,next today', center: 'title', right: views.length > 1 ? views.join(',') : '' };
}

const options = computed<CalendarOptions>(() => ({
  ...STATIC_OPTIONS,
  initialView: props.views[0],
  headerToolbar: headerToolbar(props.views),
  editable: props.editable,
  events: props.events,
  datesSet: rangeChanged,
  eventClick: opened,
  eventDrop: moved,
}));
</script>

<template>
  <div class="rc-calendar rounded-xl border border-border bg-surface p-3 md:p-4">
    <FullCalendar :options="options" />
  </div>
</template>

<style>
/* The classic theme palette, taken from the design tokens instead of its own palette.css. */
.rc-calendar {
  --fc-classic-button: var(--color-surface);
  --fc-classic-button-border: var(--color-border-strong);
  --fc-classic-button-strong: var(--color-surface-sunken);
  --fc-classic-button-strong-border: var(--color-border-strong);
  --fc-classic-button-outline: var(--color-focus);
  --fc-classic-button-foreground: var(--color-text);
  --fc-classic-primary: var(--color-primary);
  --fc-classic-primary-foreground: var(--color-on-primary);
  --fc-classic-event: var(--color-primary);
  --fc-classic-event-contrast: var(--color-on-primary);
  --fc-classic-background-event: var(--color-success);
  --fc-classic-background-event-opacity: 15%;
  --fc-classic-background-event-foreground-opacity: 50%;
  --fc-classic-highlight: color-mix(in srgb, var(--color-primary) 15%, transparent);
  --fc-classic-today: color-mix(in srgb, var(--color-primary) 8%, transparent);
  --fc-classic-now: var(--color-danger);
  --fc-classic-small-dot-width: 8px;
  --fc-classic-large-dot-width: 10px;
  --fc-classic-background: var(--color-surface);
  --fc-classic-faint: var(--color-surface-sunken);
  --fc-classic-muted: var(--color-surface-sunken);
  --fc-classic-strong: var(--color-border);
  --fc-classic-foreground: var(--color-text);
  --fc-classic-faint-foreground: var(--color-text-muted);
  --fc-classic-muted-foreground: var(--color-text-muted);
  --fc-classic-border: var(--color-border);
  --fc-classic-strong-border: var(--color-border-strong);
  color: var(--color-text);
}
.rc-calendar .rc-fc-title {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 800;
}
.rc-calendar .rc-fc-button {
  min-height: 2.75rem;
  font-weight: 600;
}
.rc-calendar .rc-fc-button-selected {
  border-color: var(--color-primary);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}
.rc-calendar .rc-fc-capitalize {
  text-transform: capitalize;
}
.rc-calendar .rc-fc-event {
  cursor: pointer;
  border-radius: 0.375rem;
  font-weight: 600;
}
</style>
