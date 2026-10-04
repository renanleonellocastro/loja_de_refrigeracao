<script setup lang="ts">
import {
  ArrowLeft,
  Ban,
  CalendarClock,
  CalendarPlus,
  Mail,
  Phone,
  ThumbsDown,
  ThumbsUp,
  UserRound,
} from 'lucide-vue-next';
import { formatDateTime, formatPhone } from '~/utils/masks';
import { canTalk, formatVisit, isOpenRequest, requestTimeline } from '~/utils/service-requests';

/**
 * UCs Responder, Aprovar, Recusar and Cancelar Solicitação (RF-32 to RF-34). A message moves the request to
 * "Em conversa"; once approved, the visit is scheduled in the agenda (/agenda?solicitacao={id}).
 */
definePageMeta({ layout: 'area', permission: 'serviceRequests.manage', title: 'Solicitação' });

type Decision = 'approve' | 'reject' | 'cancel';

const api = useApi();
const route = useRoute();
const toast = useToast();

const request = ref<ServiceRequest | null>(null);
const failed = ref(false);
const notFound = ref(false);
const decision = ref<Decision | null>(null);
const text = ref('');
const textError = ref('');
const acting = ref(false);

useHead({ title: computed(() => `Solicitação ${request.value?.id ?? ''} | Refrigeração Castro`) });

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

const DIALOGS: Record<
  Decision,
  { title: string; description: string; label: string; confirm: string; done: string; danger: boolean }
> = {
  approve: {
    title: 'Aprovar esta solicitação?',
    description: 'O cliente recebe um aviso. Depois, marque a visita na agenda de um técnico.',
    label: 'Mensagem para o cliente (opcional)',
    confirm: 'Aprovar solicitação',
    done: 'Solicitação aprovada. Agora é só marcar na agenda.',
    danger: false,
  },
  reject: {
    title: 'Recusar esta solicitação?',
    description: 'O cliente recebe o motivo por email e na página do agendamento.',
    label: 'Motivo',
    confirm: 'Recusar solicitação',
    done: 'Solicitação recusada.',
    danger: true,
  },
  cancel: {
    title: 'Cancelar esta solicitação?',
    description: 'A visita sai da agenda, se já estiver marcada, e o cliente é avisado.',
    label: 'Motivo (opcional)',
    confirm: 'Cancelar solicitação',
    done: 'Solicitação cancelada.',
    danger: true,
  },
};

const dialog = computed(() => DIALOGS[decision.value ?? 'approve']);
const dialogOpen = computed({
  get: () => decision.value !== null,
  // Reka only asks to close; opening goes through open().
  set: () => {
    decision.value = null;
  },
});

function open(next: Decision): void {
  text.value = '';
  textError.value = '';
  decision.value = next;
}

function action(kind: Decision, value: string): Promise<ServiceRequest> {
  if (kind === 'approve') {
    return unwrap(
      api.POST('/api/v1/service-requests/{id}/approval', {
        params: params(),
        body: value ? { message: value } : {},
      }),
    );
  }
  if (kind === 'reject') {
    return unwrap(
      api.POST('/api/v1/service-requests/{id}/rejection', { params: params(), body: { reason: value } }),
    );
  }
  return unwrap(
    api.POST('/api/v1/service-requests/{id}/cancellation', {
      params: params(),
      body: value ? { reason: value } : {},
    }),
  );
}

async function confirm(): Promise<void> {
  const kind = decision.value!;
  const value = text.value.trim();
  if (kind === 'reject' && value.length < 5) {
    textError.value = 'Explique o motivo para o cliente, com pelo menos 5 letras.';
    return;
  }
  acting.value = true;
  try {
    request.value = await action(kind, value);
    toast.success({ title: DIALOGS[kind].done });
    decision.value = null;
  } catch (error) {
    toast.error({ title: toApiError(error).message });
  } finally {
    acting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-5">
    <NuxtLink
      to="/solicitacoes"
      class="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-link"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      Solicitações
    </NuxtLink>

    <ErrorState v-if="failed" :kind="notFound ? 'not-found' : 'server'" :heading-level="2" @retry="load" />

    <div v-else-if="!request" class="grid gap-5 lg:grid-cols-[1fr_20rem]" role="status">
      <span class="sr-only">Carregando a solicitação…</span>
      <BaseSkeleton class="h-72 w-full rounded-xl" />
      <BaseSkeleton class="h-56 w-full rounded-xl" />
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-2xl font-extrabold text-text">Solicitação {{ request.id }}</h2>
          <p class="text-sm text-text-muted">
            {{ request.serviceType.name }} · pedida em {{ formatDateTime(request.createdAt) }}
          </p>
        </div>
        <BaseStatusBadge kind="serviceRequest" :status="request.status" :data-status="request.status" />
      </div>

      <div class="flex flex-wrap gap-2">
        <template v-if="isOpenRequest(request.status)">
          <BaseButton @click="open('approve')">
            <ThumbsUp class="size-5" aria-hidden="true" />
            Aprovar
          </BaseButton>
          <BaseButton variant="secondary" @click="open('reject')">
            <ThumbsDown class="size-5" aria-hidden="true" />
            Recusar
          </BaseButton>
        </template>
        <BaseButton v-if="request.status === 'APPROVED'" :to="`/agenda?solicitacao=${request.id}`">
          <CalendarPlus class="size-5" aria-hidden="true" />
          Marcar na agenda
        </BaseButton>
        <BaseButton v-if="request.canCancel" variant="ghost" @click="open('cancel')">
          <Ban class="size-5" aria-hidden="true" />
          Cancelar
        </BaseButton>
      </div>

      <div class="grid items-start gap-5 lg:grid-cols-[1fr_20rem]">
        <div class="flex min-w-0 flex-col gap-5">
          <ServiceConversation
            :request-id="request.id"
            :open="canTalk(request.status)"
            placeholder="Pergunte o que precisar para entender o problema."
            @sent="load"
          />
          <ServiceSummary :request="request" />
        </div>
        <div class="flex flex-col gap-5">
          <BaseCard title="Cliente" :heading-level="3">
            <div class="flex flex-col gap-2 text-text">
              <NuxtLink
                :to="`/clientes/${request.customer.id}`"
                class="inline-flex items-center gap-2 font-semibold text-link underline-offset-4 hover:underline"
              >
                <UserRound class="size-4 shrink-0" aria-hidden="true" />
                {{ request.customer.name }}
              </NuxtLink>
              <a
                :href="`mailto:${request.customer.email}`"
                class="inline-flex items-center gap-2 break-all text-sm"
              >
                <Mail class="size-4 shrink-0" aria-hidden="true" />
                {{ request.customer.email }}
              </a>
              <a
                v-if="request.customer.phone"
                :href="`tel:${request.customer.phone}`"
                class="inline-flex items-center gap-2 text-sm"
              >
                <Phone class="size-4 shrink-0" aria-hidden="true" />
                {{ formatPhone(request.customer.phone) }}
              </a>
            </div>
          </BaseCard>
          <BaseCard v-if="request.appointment" title="Visita" :heading-level="3">
            <p class="flex items-start gap-2 text-text">
              <CalendarClock class="mt-0.5 size-5 shrink-0 text-text-muted" aria-hidden="true" />
              {{ formatVisit(request.appointment) }} com {{ request.appointment.employee.name }}
            </p>
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
            <BaseTimeline :events="requestTimeline(request)" label="Andamento da solicitação" />
          </BaseCard>
        </div>
      </div>
    </template>

    <BaseDialog v-model:open="dialogOpen" :title="dialog.title" :description="dialog.description" size="sm">
      <BaseTextArea
        v-model="text"
        :label="dialog.label"
        :maxlength="decision === 'approve' ? 2000 : 1000"
        :rows="3"
        :error="textError"
        :required="decision === 'reject'"
      />
      <template #footer>
        <BaseButton variant="secondary" @click="dialogOpen = false">Voltar</BaseButton>
        <BaseButton :variant="dialog.danger ? 'danger' : 'primary'" :loading="acting" @click="confirm">
          {{ dialog.confirm }}
        </BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>
