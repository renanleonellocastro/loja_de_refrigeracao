<script setup lang="ts">
import { can } from '@rc/contracts';
import type { CalendarView } from '~/components/agenda/Calendar.vue';
import { dayRange, etagOf, storeDay, technicianColor, toCalendarEvent, type Person } from '~/utils/agenda';

/**
 * UC Consultar Agenda (RF-35): month, week, day and list on desktop, week on tablets and a day list with swipe
 * on phones. Management sees every technician in its color and can filter; technicians see their own visits.
 * With ?solicitacao={id} the management schedules an approved request (UC Cadastrar Serviço na Agenda) and on
 * desktop moves visits by drag and drop (UC Alterar Serviço na Agenda).
 */
definePageMeta({ layout: 'area', permission: 'appointments.read', title: 'Agenda' });

const ALL = 'TODOS';
const DESKTOP_VIEWS: CalendarView[] = ['timeGridWeek', 'dayGridMonth', 'timeGridDay', 'listWeek'];
const TABLET_VIEWS: CalendarView[] = ['timeGridWeek'];

const api = useApi();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const actor = useCurrentActor();
const viewport = useViewport();

const manage = computed(() => can(actor.value, 'appointments.manage'));
const appointments = ref<Appointment[]>([]);
const loading = ref(true);
const failed = ref(false);
const range = ref<{ from: string; to: string } | null>(null);
const day = ref(storeDay());
const technicians = ref<Person[]>([]);
const technician = ref(typeof route.query.tecnico === 'string' ? route.query.tecnico : ALL);

const isPhone = computed(() => viewport.value === 'phone');
const views = computed(() => (viewport.value === 'desktop' ? DESKTOP_VIEWS : TABLET_VIEWS));
const technicianOptions = computed(() => [
  { value: ALL, label: 'Todos os técnicos' },
  ...technicians.value.map((person) => ({ value: String(person.id), label: person.name })),
]);
const events = computed(() => appointments.value.map((item) => toCalendarEvent(item, manage.value)));

let loadId = 0;
async function load(): Promise<void> {
  const current = isPhone.value ? dayRange(day.value) : range.value;
  if (!current) return;
  const id = ++loadId;
  loading.value = true;
  failed.value = false;
  const employeeId = manage.value && technician.value !== ALL ? Number(technician.value) : undefined;
  const result = await unwrap(
    api.GET('/api/v1/appointments', { params: { query: { ...current, employeeId } } }),
  ).catch(() => null);
  // Only the answer of the last request counts, so a fast swipe never shows the wrong day.
  if (id !== loadId) return;
  loading.value = false;
  if (result) appointments.value = result;
  else failed.value = true;
}

async function loadTechnicians(): Promise<void> {
  if (!manage.value) return;
  try {
    const result = await unwrap(
      api.GET('/api/v1/employees/availability', { params: { query: dayRange(day.value) } }),
    );
    technicians.value = result.map((item) => item.employee);
  } catch {
    // Without the list the filter only offers every technician; the agenda itself still loads.
    technicians.value = [];
  }
}

function onRange(next: { from: string; to: string }): void {
  range.value = next;
  void load();
}

function onDay(next: string): void {
  day.value = next;
  void load();
}

watch(technician, (value) => {
  void router.replace({ query: { ...route.query, tecnico: value === ALL ? undefined : value } });
  void load();
});
watch(isPhone, () => void load());

function open(id: number): void {
  void navigateTo(`/agenda/${id}`);
}

async function move(change: {
  id: number;
  startsAt: string;
  endsAt: string;
  revert: () => void;
}): Promise<void> {
  const appointment = appointments.value.find((item) => item.id === change.id)!;
  const result = await api
    .PATCH('/api/v1/appointments/{id}', {
      params: { path: { id: change.id } },
      body: { startsAt: change.startsAt, endsAt: change.endsAt },
      headers: { 'If-Match': etagOf(appointment.version) },
    })
    .catch(() => null);
  if (result?.data) {
    toast.success({ title: 'Atendimento remarcado. O cliente e o técnico foram avisados.' });
  } else {
    change.revert();
    if (result?.response.status === 412) {
      toast.error({
        title: 'Outra pessoa mudou este atendimento. Atualizamos a agenda: confira e tente de novo.',
      });
    } else {
      const error = result ? problemToError(result.response.status, result.error) : toApiError(null);
      toast.error({ title: error.message });
    }
  }
  await load();
}

/* Scheduling an approved request from /agenda?solicitacao={id}. */
const schedulingId = computed(() => {
  const value = Number(route.query.solicitacao);
  return manage.value && Number.isInteger(value) && value > 0 ? value : null;
});
const pending = ref<ServiceRequest | null>(null);
const pendingFailed = ref(false);
const estimate = ref(60);

async function loadPending(id: number): Promise<void> {
  pendingFailed.value = false;
  try {
    const request = await unwrap(api.GET('/api/v1/service-requests/{id}', { params: { path: { id } } }));
    const type = await unwrap(
      api.GET('/api/v1/service-types/{id}', { params: { path: { id: request.serviceType.id } } }),
    ).catch(() => null);
    estimate.value = type?.estimatedMinutes ?? 60;
    pending.value = request;
  } catch {
    pendingFailed.value = true;
  }
}

const scheduleOpen = computed({
  get: () => pending.value !== null && pending.value.status === 'APPROVED',
  set: () => closeSchedule(),
});

function closeSchedule(): void {
  pending.value = null;
  void router.replace({ query: { ...route.query, solicitacao: undefined } });
}

function scheduled(appointment: Appointment): void {
  toast.success({ title: 'Visita agendada. O cliente e o técnico foram avisados.' });
  pending.value = null;
  void navigateTo(`/agenda/${appointment.id}`);
}

onMounted(() => {
  void loadTechnicians();
  if (schedulingId.value) void loadPending(schedulingId.value);
  if (isPhone.value) void load();
});
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <p class="max-w-prose text-text-muted">
        {{
          manage
            ? 'Atendimentos de toda a equipe. Cada técnico tem uma cor; clique num atendimento para abrir.'
            : 'Seus atendimentos. Toque num atendimento para ver o endereço e finalizar.'
        }}
      </p>
      <div v-if="manage" class="w-full sm:w-72">
        <FormSelect v-model="technician" label="Técnico" :options="technicianOptions" />
      </div>
    </div>

    <ul
      v-if="manage && technicians.length > 0"
      class="flex flex-wrap gap-3 text-sm"
      aria-label="Cores dos técnicos"
    >
      <li v-for="person in technicians" :key="person.id" class="flex items-center gap-2 text-text">
        <span
          class="size-3 rounded-full"
          :style="{ backgroundColor: technicianColor(person.id) }"
          aria-hidden="true"
        />
        {{ person.name }}
      </li>
    </ul>

    <BaseAlert v-if="pendingFailed" tone="danger" title="Não encontramos a solicitação">
      Confira o número ou abra pela lista de solicitações.
    </BaseAlert>
    <BaseAlert
      v-else-if="pending && pending.status !== 'APPROVED'"
      tone="warning"
      title="Esta solicitação não está esperando agendamento"
      data-testid="not-schedulable"
    >
      A solicitação {{ pending.id }} está {{ pending.statusLabel.toLowerCase() }}.
      <NuxtLink :to="`/solicitacoes/${pending.id}`" class="font-semibold underline"
        >Abrir solicitação</NuxtLink
      >
    </BaseAlert>

    <ErrorState v-if="failed" kind="server" :heading-level="2" @retry="load" />
    <AgendaDayList
      v-else-if="isPhone"
      :day="day"
      :appointments="appointments"
      :loading="loading"
      :show-technician="manage"
      @change="onDay"
    />
    <template v-else>
      <p class="sr-only" role="status">{{ loading ? 'Carregando a agenda…' : '' }}</p>
      <AgendaCalendar
        :key="viewport"
        :events="events"
        :views="views"
        :editable="manage && viewport === 'desktop'"
        @range="onRange"
        @open="open"
        @move="move"
      />
    </template>

    <BaseDialog
      v-model:open="scheduleOpen"
      :title="`Agendar solicitação ${pending?.id ?? ''}`"
      :description="pending ? `${pending.serviceType.name} para ${pending.customer.name}` : undefined"
    >
      <AgendaScheduleForm
        v-if="pending"
        :request="pending"
        :estimated-minutes="estimate"
        @saved="scheduled"
        @cancel="closeSchedule"
      />
    </BaseDialog>
  </div>
</template>
