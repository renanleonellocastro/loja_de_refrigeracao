<script setup lang="ts">
import { ArrowLeft, Ban, CalendarCheck, CheckCheck, ThumbsDown } from 'lucide-vue-next';
import { formatDateTime } from '~/utils/masks';
import { isOpenQuote, QUOTE_NEXT_STEP, type Quote } from '~/utils/quotes';

/**
 * UC Aceitar ou Recusar Orçamento: the quote with the value, the last day to accept, what is included, the
 * notes and the conversation with the store. Accepting asks for the visit days and address and creates the
 * visit request; declining and canceling take an optional reason. Each action shows only when the API allows.
 */
definePageMeta({ layout: 'area', permission: 'quotes.decide', title: 'Orçamento' });

type Decision = 'decline' | 'cancel';

const api = useApi();
const route = useRoute();
const toast = useToast();

const quote = ref<Quote | null>(null);
const failed = ref(false);
const notFound = ref(false);
const accepting = ref(false);
const decision = ref<Decision | null>(null);
const reason = ref('');
const acting = ref(false);

useHead({ title: computed(() => `Orçamento ${quote.value?.id ?? ''} | Refrigeração Castro`) });

const params = () => ({ path: { id: Number(route.params.id) } });

async function load(): Promise<void> {
  failed.value = false;
  try {
    quote.value = await unwrap(api.GET('/api/v1/quotes/{id}', { params: params() }));
  } catch (error) {
    notFound.value = toApiError(error).status === 404;
    failed.value = true;
  }
}

const DIALOGS: Record<Decision, { title: string; description: string; confirm: string; done: string }> = {
  decline: {
    title: 'Recusar este orçamento?',
    description: 'A loja é avisada. Se quiser, conte o motivo para a gente melhorar.',
    confirm: 'Recusar orçamento',
    done: 'Orçamento recusado.',
  },
  cancel: {
    title: 'Cancelar este pedido de orçamento?',
    description: 'A loja para de preparar o orçamento e é avisada na hora.',
    confirm: 'Cancelar pedido',
    done: 'Pedido de orçamento cancelado.',
  },
};

const dialog = computed(() => DIALOGS[decision.value ?? 'decline']);
const dialogOpen = computed({
  get: () => decision.value !== null,
  // Reka only asks to close; opening goes through open().
  set: () => {
    decision.value = null;
  },
});

function open(next: Decision): void {
  reason.value = '';
  decision.value = next;
}

async function confirm(): Promise<void> {
  const kind = decision.value!;
  const text = reason.value.trim();
  const options = { params: params(), body: text ? { reason: text } : {} };
  acting.value = true;
  try {
    quote.value = await unwrap(
      kind === 'decline'
        ? api.POST('/api/v1/quotes/{id}/decline', options)
        : api.POST('/api/v1/quotes/{id}/cancellation', options),
    );
    toast.success({ title: DIALOGS[kind].done });
    decision.value = null;
  } catch (error) {
    toast.error({ title: toApiError(error).message });
  } finally {
    acting.value = false;
  }
}

function accepted(next: Quote): void {
  quote.value = next;
  accepting.value = false;
  toast.success({ title: 'Orçamento aceito. Pedido de visita enviado.' });
}

onMounted(load);
</script>

<template>
  <div class="mx-auto flex max-w-5xl flex-col gap-5">
    <NuxtLink
      to="/minha-conta/orcamentos"
      class="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-link"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      Meus orçamentos
    </NuxtLink>

    <ErrorState v-if="failed" :kind="notFound ? 'not-found' : 'server'" :heading-level="2" @retry="load" />

    <div v-else-if="!quote" class="grid gap-5 lg:grid-cols-[1fr_20rem]" role="status">
      <span class="sr-only">Carregando o orçamento…</span>
      <BaseSkeleton class="h-72 w-full rounded-xl" />
      <BaseSkeleton class="h-56 w-full rounded-xl" />
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-2xl font-extrabold text-text">{{ quote.serviceType.name }}</h2>
          <p class="text-sm text-text-muted">
            Orçamento {{ quote.id }} · pedido em {{ formatDateTime(quote.createdAt) }}
          </p>
        </div>
        <BaseStatusBadge kind="quote" :status="quote.status" :data-status="quote.status" />
      </div>
      <p class="rounded-lg bg-surface-sunken p-4 text-text" aria-live="polite">
        {{ QUOTE_NEXT_STEP[quote.status] }}
      </p>

      <BaseAlert v-if="quote.serviceRequestId" tone="success" data-testid="quote-request">
        <span class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span>Pedido de visita {{ quote.serviceRequestId }} criado com as datas que você escolheu.</span>
          <BaseButton :to="`/minha-conta/agendamentos/${quote.serviceRequestId}`" size="sm">
            <CalendarCheck class="size-4.5" aria-hidden="true" />
            Ver agendamento
          </BaseButton>
        </span>
      </BaseAlert>

      <div class="grid items-start gap-5 lg:grid-cols-[1fr_20rem]">
        <div class="flex min-w-0 flex-col gap-5">
          <QuoteOffer v-if="quote.amountCents !== null" :quote="quote" />
          <QuoteAcceptForm
            v-if="accepting"
            :quote-id="quote.id"
            @accepted="accepted"
            @close="accepting = false"
          />
          <ServiceConversation
            :request-id="quote.id"
            resource="quotes"
            :open="isOpenQuote(quote.status)"
            placeholder="Tire uma dúvida sobre o orçamento."
            empty-text="Nenhuma mensagem ainda. Use a conversa para tirar dúvidas sobre o orçamento."
            @sent="load"
          />
          <QuoteRequest :quote="quote" />
        </div>
        <div class="flex flex-col gap-5">
          <div
            v-if="(quote.canAccept && !accepting) || quote.canDecline || quote.canCancel"
            class="flex flex-col gap-2"
          >
            <BaseButton v-if="quote.canAccept && !accepting" block @click="accepting = true">
              <CheckCheck class="size-5" aria-hidden="true" />
              Aceitar
            </BaseButton>
            <BaseButton v-if="quote.canDecline" variant="secondary" block @click="open('decline')">
              <ThumbsDown class="size-5" aria-hidden="true" />
              Recusar
            </BaseButton>
            <BaseButton v-if="quote.canCancel" variant="ghost" block @click="open('cancel')">
              <Ban class="size-5" aria-hidden="true" />
              Cancelar
            </BaseButton>
          </div>
          <BaseCard v-if="quote.declineReason" title="Motivo" :heading-level="3">
            <p class="whitespace-pre-line text-text">{{ quote.declineReason }}</p>
          </BaseCard>
        </div>
      </div>
    </template>

    <BaseDialog v-model:open="dialogOpen" :title="dialog.title" :description="dialog.description" size="sm">
      <BaseTextArea v-model="reason" label="Motivo (opcional)" :maxlength="1000" :rows="3" />
      <template #footer>
        <BaseButton variant="secondary" @click="dialogOpen = false">Voltar</BaseButton>
        <BaseButton variant="danger" :loading="acting" @click="confirm">{{ dialog.confirm }}</BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>
