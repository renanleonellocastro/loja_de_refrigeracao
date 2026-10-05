<script setup lang="ts">
import { CalendarCheck, Clock } from 'lucide-vue-next';
import {
  DURATION_OPTIONS,
  addDays,
  addMinutes,
  dayRange,
  durationOf,
  formatTimeRange,
  fromStoreWall,
  storeDay,
  storeTime,
  type Availability,
} from '~/utils/agenda';
import { durationLabel, formatWindow, sortWindows, type VisitWindow } from '~/utils/service-requests';

/**
 * UCs Cadastrar and Alterar Serviço na Agenda: technician, day, start and duration, with the busy times of
 * the chosen technician and the days the customer prefers. Editing sends If-Match with the ETag.
 */
const props = withDefaults(
  defineProps<{
    /** Request to schedule (create). */
    request?: ServiceRequest | null;
    /** Visit to change (edit) with the ETag of the version on screen. */
    appointment?: Appointment | null;
    etag?: string;
    estimatedMinutes?: number;
  }>(),
  { request: null, appointment: null, etag: '', estimatedMinutes: 60 },
);

const emit = defineEmits<{ saved: [appointment: Appointment]; stale: []; cancel: [] }>();

const api = useApi();

const PERIOD_START: Record<VisitWindow['period'], string> = { MORNING: '08:00', AFTERNOON: '13:00' };
const today = storeDay();

function initialValues() {
  if (props.appointment) {
    return {
      employeeId: String(props.appointment.employee.id),
      day: storeDay(props.appointment.startsAt),
      time: storeTime(props.appointment.startsAt),
      duration: String(durationOf(props.appointment)),
    };
  }
  const window = futureWindows.value[0];
  return {
    employeeId: '',
    day: window?.day ?? addDays(today, 1),
    time: window ? PERIOD_START[window.period] : '08:00',
    duration: String(props.estimatedMinutes),
  };
}

const futureWindows = computed(() =>
  sortWindows(props.request?.windows ?? []).filter((window) => window.day >= today),
);

const form = useForm(initialValues(), {
  inline: true,
  validate: (values) => {
    const errors: FieldErrors = {};
    if (!values.employeeId) errors.employeeId = 'Escolha o técnico.';
    if (!values.day) errors.day = 'Escolha o dia.';
    else if (values.day < today) errors.day = 'Escolha hoje ou um dia futuro.';
    if (!values.time) errors.time = 'Escolha o horário de início.';
    return errors;
  },
});

const availability = ref<Availability[]>([]);
const availabilityFailed = ref(false);
const failureStatus = ref(0);

async function loadAvailability(day: string): Promise<void> {
  availabilityFailed.value = false;
  if (!day) return;
  try {
    availability.value = await unwrap(
      api.GET('/api/v1/employees/availability', { params: { query: dayRange(day) } }),
    );
  } catch {
    availabilityFailed.value = true;
  }
}

watch(() => form.values.day, loadAvailability, { immediate: true });

const employeeOptions = computed(() =>
  availability.value.map((item) => ({ value: String(item.employee.id), label: item.employee.name })),
);

const durationOptions = computed(() => {
  const minutes = new Set([...DURATION_OPTIONS, Number(form.values.duration)]);
  return [...minutes]
    .sort((a, b) => a - b)
    .map((value) => ({ value: String(value), label: durationLabel(value) }));
});

/** Busy times of the chosen technician on the chosen day, except the visit being changed. */
const busy = computed(() => {
  const chosen = availability.value.find((item) => String(item.employee.id) === form.values.employeeId);
  return (chosen?.busy ?? []).filter((interval) => interval.appointmentId !== props.appointment?.id);
});

function pickWindow(window: VisitWindow): void {
  form.values.day = window.day;
  form.values.time = PERIOD_START[window.period];
}

const isEdit = computed(() => props.appointment !== null);

function interval(values: { day: string; time: string; duration: string }) {
  const startsAt = fromStoreWall(`${values.day}T${values.time}`);
  return { startsAt, endsAt: addMinutes(startsAt, Number(values.duration)) };
}

async function save(values: typeof form.values): Promise<void> {
  const body = { employeeId: Number(values.employeeId), ...interval(values) };
  const result = props.appointment
    ? await api.PATCH('/api/v1/appointments/{id}', {
        params: { path: { id: props.appointment.id } },
        body,
        headers: { 'If-Match': props.etag },
      })
    : await api.POST('/api/v1/appointments', {
        body: { serviceRequestId: props.request!.id, ...body },
      });
  failureStatus.value = result.response.status;
  emit('saved', result.data ?? fail(result.response.status, result.error));
}

/** A 412 means someone else saved first; the screen reloads the visit after it. */
function fail(status: number, body: unknown): never {
  if (status !== 412) throw problemToError(status, body);
  throw new ApiError(
    412,
    'Outra pessoa mudou este atendimento enquanto você editava. Carregamos a versão atual: confira e tente de novo.',
  );
}

async function send(): Promise<void> {
  failureStatus.value = 0;
  const ok = await form.submit(save);
  if (!ok && failureStatus.value === 412) emit('stale');
}

const alertTitle = computed(() => {
  if (failureStatus.value === 409) return 'Horário ocupado';
  if (failureStatus.value === 412) return 'Atendimento alterado';
  return 'Não deu para salvar';
});
</script>

<template>
  <form class="flex flex-col gap-5" novalidate @submit.prevent="send">
    <BaseAlert v-if="form.message.value" tone="danger" :title="alertTitle" data-testid="schedule-error">
      {{ form.message.value }}
    </BaseAlert>

    <section v-if="futureWindows.length > 0" aria-labelledby="schedule-windows">
      <h3 id="schedule-windows" class="mb-2 text-sm font-bold text-text">Dias que o cliente prefere</h3>
      <ul class="flex flex-wrap gap-2">
        <li v-for="window in futureWindows" :key="`${window.day}-${window.period}`">
          <button
            type="button"
            class="min-h-11 rounded-full border border-border-strong px-4 text-left text-sm font-semibold text-text transition-colors hover:bg-surface-sunken first-letter:uppercase"
            :aria-pressed="form.values.day === window.day && form.values.time === PERIOD_START[window.period]"
            @click="pickWindow(window)"
          >
            {{ formatWindow(window) }}
          </button>
        </li>
      </ul>
    </section>

    <FormSelect
      v-model="form.values.employeeId"
      label="Técnico"
      placeholder="Escolha o técnico"
      :options="employeeOptions"
      :error="form.error('employeeId')"
      required
    />

    <div class="grid gap-4 sm:grid-cols-3">
      <BaseTextField v-model="form.values.day" label="Dia" type="date" :error="form.error('day')" required />
      <BaseTextField
        v-model="form.values.time"
        label="Início"
        type="time"
        :error="form.error('time')"
        required
      />
      <FormSelect v-model="form.values.duration" label="Duração" :options="durationOptions" />
    </div>

    <section aria-labelledby="schedule-busy" class="rounded-lg bg-surface-sunken p-4">
      <h3 id="schedule-busy" class="flex items-center gap-2 text-sm font-bold text-text">
        <Clock class="size-4" aria-hidden="true" />
        Horários ocupados no dia
      </h3>
      <p v-if="availabilityFailed" class="mt-2 text-sm text-text-muted">
        Não conseguimos ver a agenda do técnico agora. Você ainda pode salvar: a loja confere o horário.
      </p>
      <p v-else-if="!form.values.employeeId" class="mt-2 text-sm text-text-muted">
        Escolha o técnico para ver os horários dele.
      </p>
      <p v-else-if="busy.length === 0" class="mt-2 text-sm text-text-muted" data-testid="busy-free">
        Dia livre para este técnico.
      </p>
      <ul v-else class="mt-2 flex flex-wrap gap-2" aria-label="Horários ocupados">
        <li
          v-for="item in busy"
          :key="item.appointmentId"
          class="rounded-md bg-warning-soft px-3 py-1 text-sm font-semibold text-on-warning-soft"
        >
          {{ formatTimeRange(item.startsAt, item.endsAt) }}
        </li>
      </ul>
    </section>

    <div class="flex flex-wrap justify-end gap-2">
      <BaseButton variant="secondary" @click="emit('cancel')">Cancelar</BaseButton>
      <BaseButton type="submit" :loading="form.pending.value">
        <CalendarCheck class="size-5" aria-hidden="true" />
        {{ isEdit ? 'Salvar alteração' : 'Agendar visita' }}
      </BaseButton>
    </div>
  </form>
</template>
