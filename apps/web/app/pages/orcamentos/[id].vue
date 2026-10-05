<script setup lang="ts">
import { ArrowLeft, Ban, CalendarCheck, Mail, Phone, UserRound } from 'lucide-vue-next';
import { formatDateTime, formatPhone } from '~/utils/masks';
import { isOpenQuote, type Quote } from '~/utils/quotes';

/**
 * UC Responder Orçamento: the service type, description, photos and customer contact, the conversation to ask
 * questions before answering, and the answer form while the quote is "Solicitado". The store can cancel while
 * the quote is open.
 */
definePageMeta({ layout: 'area', permission: 'quotes.answer', title: 'Orçamento' });

const api = useApi();
const route = useRoute();
const toast = useToast();

const quote = ref<Quote | null>(null);
const failed = ref(false);
const notFound = ref(false);
const cancelOpen = ref(false);
const reason = ref('');
const canceling = ref(false);

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

function answered(next: Quote): void {
  quote.value = next;
  toast.success({ title: 'Orçamento enviado. O cliente recebe um email.' });
}

function openCancel(): void {
  reason.value = '';
  cancelOpen.value = true;
}

async function cancel(): Promise<void> {
  canceling.value = true;
  try {
    const text = reason.value.trim();
    quote.value = await unwrap(
      api.POST('/api/v1/quotes/{id}/cancellation', { params: params(), body: text ? { reason: text } : {} }),
    );
    cancelOpen.value = false;
    toast.success({ title: 'Orçamento cancelado.' });
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
      to="/orcamentos"
      class="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-link"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      Orçamentos
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
          <h2 class="text-2xl font-extrabold text-text">Orçamento {{ quote.id }}</h2>
          <p class="text-sm text-text-muted">
            {{ quote.serviceType.name }} · pedido em {{ formatDateTime(quote.createdAt) }}
          </p>
        </div>
        <BaseStatusBadge kind="quote" :status="quote.status" :data-status="quote.status" />
      </div>

      <div class="grid items-start gap-5 lg:grid-cols-[1fr_20rem]">
        <div class="flex min-w-0 flex-col gap-5">
          <QuoteRequest :quote="quote" />
          <QuoteAnswerForm v-if="quote.status === 'REQUESTED'" :quote-id="quote.id" @answered="answered" />
          <QuoteOffer v-if="quote.amountCents !== null" :quote="quote" />
          <ServiceConversation
            :request-id="quote.id"
            resource="quotes"
            :open="isOpenQuote(quote.status)"
            placeholder="Pergunte o que precisar para calcular o valor."
            empty-text="Nenhuma mensagem ainda. Pergunte ao cliente o que precisar antes de responder."
            @sent="load"
          />
        </div>
        <div class="flex flex-col gap-5">
          <BaseCard title="Cliente" :heading-level="3">
            <div class="flex flex-col gap-2 text-text">
              <NuxtLink
                :to="`/clientes/${quote.customer.id}`"
                class="inline-flex items-center gap-2 font-semibold text-link underline-offset-4 hover:underline"
              >
                <UserRound class="size-4 shrink-0" aria-hidden="true" />
                {{ quote.customer.name }}
              </NuxtLink>
              <a
                :href="`mailto:${quote.customer.email}`"
                class="inline-flex min-h-11 items-center gap-2 break-all text-sm"
              >
                <Mail class="size-4 shrink-0" aria-hidden="true" />
                {{ quote.customer.email }}
              </a>
              <a
                v-if="quote.customer.phone"
                :href="`tel:${quote.customer.phone}`"
                class="inline-flex min-h-11 items-center gap-2 text-sm"
              >
                <Phone class="size-4 shrink-0" aria-hidden="true" />
                {{ formatPhone(quote.customer.phone) }}
              </a>
            </div>
          </BaseCard>
          <BaseCard v-if="quote.serviceRequestId" title="Visita" :heading-level="3">
            <p class="text-text">O cliente aceitou e pediu uma visita.</p>
            <BaseButton
              :to="`/solicitacoes/${quote.serviceRequestId}`"
              variant="secondary"
              size="sm"
              class="mt-3"
            >
              <CalendarCheck class="size-4.5" aria-hidden="true" />
              Ver solicitação {{ quote.serviceRequestId }}
            </BaseButton>
          </BaseCard>
          <BaseCard v-if="quote.declineReason" title="Motivo" :heading-level="3">
            <p class="whitespace-pre-line text-text">{{ quote.declineReason }}</p>
          </BaseCard>
          <BaseButton v-if="quote.canCancel" variant="ghost" @click="openCancel">
            <Ban class="size-5" aria-hidden="true" />
            Cancelar orçamento
          </BaseButton>
        </div>
      </div>
    </template>

    <BaseDialog
      v-model:open="cancelOpen"
      title="Cancelar este orçamento?"
      description="O cliente é avisado por email."
      size="sm"
    >
      <BaseTextArea v-model="reason" label="Motivo (opcional)" :maxlength="1000" :rows="3" />
      <template #footer>
        <BaseButton variant="secondary" @click="cancelOpen = false">Voltar</BaseButton>
        <BaseButton variant="danger" :loading="canceling" @click="cancel">Cancelar orçamento</BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>
