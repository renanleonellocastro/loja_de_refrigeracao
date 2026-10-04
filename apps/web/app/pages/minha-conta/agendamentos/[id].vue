<script setup lang="ts">
import { ArrowLeft, Ban, CalendarClock, Info, UserRound } from 'lucide-vue-next';
import { formatDateTime } from '~/utils/masks';
import {
  CANCEL_RULE,
  canTalk,
  formatVisit,
  REQUEST_NEXT_STEP,
  requestTimeline,
} from '~/utils/service-requests';

/**
 * UC Consultar Meus Agendamentos: the request with its problem, photos, days, the visit when scheduled and the
 * conversation with the store. The customer cancels while `canCancel` allows (until 18:00 of the day before).
 */
definePageMeta({ layout: 'area', permission: 'serviceRequests.cancel', title: 'Agendamento' });

const api = useApi();
const route = useRoute();
const toast = useToast();

const request = ref<ServiceRequest | null>(null);
const failed = ref(false);
const notFound = ref(false);
const cancelOpen = ref(false);
const reason = ref('');
const canceling = ref(false);

useHead({ title: computed(() => `Agendamento ${request.value?.id ?? ''} | Refrigeração Castro`) });

const params = () => ({ path: { id: Number(route.params.id) } });

async function load(): Promise<void> {
  failed.value = false;
  try {
    request.value = await unwrap(api.GET('/api/v1/service-requests/{id}', { params: params() }));
  } catch (error) {
    notFound.value = toApiError(error).status === 404;
    failed.value = true;
  }
}

async function cancel(): Promise<void> {
  canceling.value = true;
  try {
    const text = reason.value.trim();
    request.value = await unwrap(
      api.POST('/api/v1/service-requests/{id}/cancellation', {
        params: params(),
        body: text ? { reason: text } : {},
      }),
    );
    cancelOpen.value = false;
    toast.success({ title: 'Agendamento cancelado.' });
  } catch (error) {
    toast.error({ title: toApiError(error).message });
  } finally {
    canceling.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-5">
    <NuxtLink
      to="/minha-conta/agendamentos"
      class="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-link"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      Meus agendamentos
    </NuxtLink>

    <ErrorState v-if="failed" :kind="notFound ? 'not-found' : 'server'" :heading-level="2" @retry="load" />

    <div v-else-if="!request" class="grid gap-5 lg:grid-cols-[1fr_20rem]" role="status">
      <span class="sr-only">Carregando o agendamento…</span>
      <BaseSkeleton class="h-72 w-full rounded-xl" />
      <BaseSkeleton class="h-56 w-full rounded-xl" />
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-2xl font-extrabold text-text">{{ request.serviceType.name }}</h2>
          <p class="text-sm text-text-muted">
            Solicitação {{ request.id }} · feita em {{ formatDateTime(request.createdAt) }}
          </p>
        </div>
        <BaseStatusBadge kind="serviceRequest" :status="request.status" :data-status="request.status" />
      </div>
      <p class="rounded-lg bg-surface-sunken p-4 text-text" aria-live="polite">
        {{ REQUEST_NEXT_STEP[request.status] }}
      </p>

      <div class="grid items-start gap-5 lg:grid-cols-[1fr_20rem]">
        <div class="flex min-w-0 flex-col gap-5">
          <ServiceConversation
            :request-id="request.id"
            :open="canTalk(request.status)"
            placeholder="Responda a loja ou tire uma dúvida."
            @sent="load"
          />
          <ServiceSummary :request="request" />
        </div>
        <div class="flex flex-col gap-5">
          <BaseCard v-if="request.appointment" title="Visita" :heading-level="3">
            <div class="flex flex-col gap-3 text-text" data-testid="visit">
              <p class="flex items-start gap-2">
                <CalendarClock class="mt-0.5 size-5 shrink-0 text-text-muted" aria-hidden="true" />
                {{ formatVisit(request.appointment) }}
              </p>
              <p class="flex items-start gap-2">
                <UserRound class="mt-0.5 size-5 shrink-0 text-text-muted" aria-hidden="true" />
                Técnico: {{ request.appointment.employee.name }}
              </p>
            </div>
          </BaseCard>
          <BaseCard
            v-if="request.rejectionReason || request.cancellationReason"
            title="Motivo"
            :heading-level="3"
          >
            <p class="whitespace-pre-line text-text">
              {{ request.rejectionReason ?? request.cancellationReason }}
            </p>
          </BaseCard>
          <BaseCard title="Andamento" :heading-level="3">
            <BaseTimeline :events="requestTimeline(request)" label="Andamento do agendamento" />
          </BaseCard>
          <template v-if="request.canCancel">
            <BaseButton variant="secondary" @click="cancelOpen = true">
              <Ban class="size-4.5" aria-hidden="true" />
              Cancelar agendamento
            </BaseButton>
            <p class="flex items-start gap-2 text-sm text-text-muted">
              <Info class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {{ CANCEL_RULE }}
            </p>
          </template>
        </div>
      </div>
    </template>

    <BaseDialog
      v-model:open="cancelOpen"
      title="Cancelar este agendamento?"
      :description="`A loja é avisada na hora. ${CANCEL_RULE}`"
      size="sm"
    >
      <BaseTextArea v-model="reason" label="Motivo (opcional)" :maxlength="1000" :rows="3" />
      <template #footer>
        <BaseButton variant="secondary" @click="cancelOpen = false">Voltar</BaseButton>
        <BaseButton variant="danger" :loading="canceling" @click="cancel">Cancelar agendamento</BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>
