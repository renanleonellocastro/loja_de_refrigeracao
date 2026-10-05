<script setup lang="ts">
import { can } from '@rc/contracts';
import { ArrowLeft, CalendarClock, MapPin, Navigation, Phone, Trash2, UserRound } from 'lucide-vue-next';
import {
  REPORT_STATUS_LABELS,
  appliance,
  appointmentAddress,
  formatLongDay,
  formatTimeRange,
  isMovable,
  mapsUrl,
  storeDay,
  technicianColor,
} from '~/utils/agenda';
import { formatDateTime, formatMoney, formatPhone } from '~/utils/masks';

/**
 * A visit of the agenda: customer, phone, address with the route, the problem with its photos, the status and
 * the report. Management reschedules (If-Match with the ETag) and the super user deletes; the technician
 * finalizes the service here (UC Finalizar Serviço).
 */
definePageMeta({ layout: 'area', permission: 'appointments.read', title: 'Atendimento' });

const api = useApi();
const route = useRoute();
const toast = useToast();
const actor = useCurrentActor();
const { confirm } = useConfirm();

const appointment = ref<Appointment | null>(null);
const etag = ref('');
const request = ref<ServiceRequest | null>(null);
const failed = ref(false);
const notFound = ref(false);
const editing = ref(false);
const deleting = ref(false);

const id = computed(() => Number(route.params.id));
useHead({ title: computed(() => `Atendimento ${id.value} | Refrigeração Castro`) });

const canManage = computed(() => can(actor.value, 'appointments.manage'));
const canDelete = computed(() => can(actor.value, 'appointments.delete'));
const canFinish = computed(
  () => can(actor.value, 'appointments.complete') && appointment.value?.request.status === 'SCHEDULED',
);

async function load(): Promise<void> {
  failed.value = false;
  const result = await api
    .GET('/api/v1/appointments/{id}', { params: { path: { id: id.value } } })
    .catch(() => null);
  if (!result?.data) {
    notFound.value = result?.response.status === 404;
    failed.value = true;
    return;
  }
  appointment.value = result.data;
  etag.value = result.response.headers.get('etag') ?? '';
  // The photos of the problem come with the request; without them the visit still shows.
  request.value = await unwrap(
    api.GET('/api/v1/service-requests/{id}', { params: { path: { id: result.data.request.id } } }),
  ).catch(() => null);
}

function saved(next: Appointment): void {
  editing.value = false;
  toast.success({ title: 'Atendimento alterado. O cliente e o técnico foram avisados.' });
  appointment.value = next;
  void load();
}

function stale(): void {
  void load();
}

function finished(next: Appointment): void {
  appointment.value = next;
  void load();
}

async function remove(): Promise<void> {
  const confirmed = await confirm({
    title: 'Excluir este atendimento da agenda?',
    description: 'A solicitação volta a esperar agendamento e o cliente e o técnico são avisados.',
    confirmLabel: 'Excluir atendimento',
    danger: true,
  });
  if (!confirmed) return;
  deleting.value = true;
  try {
    await unwrap(api.DELETE('/api/v1/appointments/{id}', { params: { path: { id: id.value } } }));
    toast.success({ title: 'Atendimento excluído da agenda.' });
    await navigateTo('/agenda');
  } catch (error) {
    toast.error({ title: toApiError(error).message });
  } finally {
    deleting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-5">
    <NuxtLink
      to="/agenda"
      class="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-link"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      Agenda
    </NuxtLink>

    <ErrorState v-if="failed" :kind="notFound ? 'not-found' : 'server'" :heading-level="2" @retry="load" />

    <div v-else-if="!appointment" class="grid gap-5 lg:grid-cols-[1fr_20rem]" role="status">
      <span class="sr-only">Carregando o atendimento…</span>
      <BaseSkeleton class="h-72 w-full rounded-xl" />
      <BaseSkeleton class="h-56 w-full rounded-xl" />
    </div>

    <template v-else>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-2xl font-extrabold text-text">{{ appointment.request.serviceType }}</h2>
          <p class="flex items-center gap-2 text-text-muted first-letter:uppercase">
            <CalendarClock class="size-4 shrink-0" aria-hidden="true" />
            {{ formatLongDay(storeDay(appointment.startsAt)) }},
            {{ formatTimeRange(appointment.startsAt, appointment.endsAt) }}
          </p>
          <p class="mt-1 flex items-center gap-2 text-sm text-text">
            <span
              class="size-3 rounded-full"
              :style="{ backgroundColor: technicianColor(appointment.employee.id) }"
              aria-hidden="true"
            />
            Técnico: {{ appointment.employee.name }}
          </p>
        </div>
        <BaseStatusBadge
          kind="serviceRequest"
          :status="appointment.request.status"
          :data-status="appointment.request.status"
        />
      </div>

      <div v-if="canManage || canDelete" class="flex flex-wrap gap-2">
        <BaseButton v-if="canManage && isMovable(appointment)" variant="secondary" @click="editing = true">
          <CalendarClock class="size-5" aria-hidden="true" />
          Remarcar
        </BaseButton>
        <BaseButton v-if="canDelete" variant="danger" :loading="deleting" @click="remove">
          <Trash2 class="size-5" aria-hidden="true" />
          Excluir
        </BaseButton>
      </div>

      <BaseAlert
        v-if="appointment.report?.status === 'REWORK'"
        tone="warning"
        title="A gerência pediu um ajuste no relatório"
        data-testid="rework-comment"
      >
        {{ appointment.report.reworkComment }}
      </BaseAlert>

      <div class="grid items-start gap-5 lg:grid-cols-[1fr_20rem]">
        <div class="flex min-w-0 flex-col gap-5">
          <BaseCard title="Problema" :heading-level="3">
            <p class="text-sm font-semibold text-text-muted">{{ appliance(appointment.request) }}</p>
            <p class="mt-2 whitespace-pre-line text-text" data-testid="appointment-problem">
              {{ appointment.request.problem }}
            </p>
            <div v-if="request" class="mt-4">
              <ServicePhotos :photos="request.photos" />
            </div>
          </BaseCard>

          <BaseCard v-if="appointment.report" title="Relatório do serviço" :heading-level="3">
            <p class="mb-3 text-sm font-semibold text-text-muted" data-testid="report-status">
              {{ REPORT_STATUS_LABELS[appointment.report.status] }} · enviado em
              {{ formatDateTime(appointment.report.submittedAt) }}
            </p>
            <dl class="flex flex-col gap-3 text-sm">
              <div>
                <dt class="font-semibold text-text-muted">Defeito encontrado</dt>
                <dd class="whitespace-pre-line text-text">
                  {{ appointment.report.defectFound ? appointment.report.defectDescription : 'Não' }}
                </dd>
              </div>
              <div>
                <dt class="font-semibold text-text-muted">Reparo realizado</dt>
                <dd class="whitespace-pre-line text-text">{{ appointment.report.repairDescription }}</dd>
              </div>
              <div v-if="appointment.report.amountCents !== null">
                <dt class="font-semibold text-text-muted">Valor do serviço</dt>
                <dd class="text-text" data-testid="report-amount">
                  {{ formatMoney(appointment.report.amountCents) }}
                </dd>
              </div>
            </dl>
            <div class="mt-4">
              <ServicePhotos :photos="appointment.report.photos" subject="do serviço" />
            </div>
          </BaseCard>

          <BaseCard v-if="canFinish" id="finalizar" title="Finalizar serviço" :heading-level="3">
            <AgendaReportForm :key="appointment.version" :appointment="appointment" @done="finished" />
          </BaseCard>
        </div>

        <div class="flex flex-col gap-5">
          <BaseCard title="Cliente" :heading-level="3">
            <div class="flex flex-col gap-3 text-text">
              <p class="flex items-center gap-2 font-semibold">
                <UserRound class="size-4 shrink-0" aria-hidden="true" />
                {{ appointment.request.customer.name }}
              </p>
              <a
                v-if="appointment.request.customer.phone"
                :href="`tel:${appointment.request.customer.phone}`"
                class="inline-flex min-h-11 items-center gap-2 font-semibold text-link"
              >
                <Phone class="size-4 shrink-0" aria-hidden="true" />
                {{ formatPhone(appointment.request.customer.phone) }}
              </a>
              <p class="flex items-start gap-2 text-sm">
                <MapPin class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {{ appointmentAddress(appointment.request.address) }}
              </p>
              <BaseButton :to="mapsUrl(appointment.request.address)" variant="secondary" block>
                <Navigation class="size-5" aria-hidden="true" />
                Abrir rota no mapa
              </BaseButton>
            </div>
          </BaseCard>
          <BaseCard v-if="canManage" title="Solicitação" :heading-level="3">
            <NuxtLink :to="`/solicitacoes/${appointment.request.id}`" class="font-semibold text-link">
              Solicitação {{ appointment.request.id }}
            </NuxtLink>
          </BaseCard>
        </div>
      </div>

      <BaseDialog
        v-model:open="editing"
        title="Remarcar atendimento"
        :description="appointment.request.customer.name"
      >
        <AgendaScheduleForm
          :appointment="appointment"
          :etag="etag"
          @saved="saved"
          @stale="stale"
          @cancel="editing = false"
        />
      </BaseDialog>
    </template>
  </div>
</template>
