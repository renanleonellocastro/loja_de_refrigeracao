<script setup lang="ts">
import { ArrowLeft, Ban, Wallet } from 'lucide-vue-next';
import { formatDateTime } from '~/utils/masks';
import { STORE_INFO } from '~/utils/store';
import { ORDER_NEXT_STEP, orderTimeline } from '~/utils/orders';

/** UC Consultar Pedido and Cancelar Pedido (RF-23, RF-24, D3): the customer cancels while it is "Em análise". */
definePageMeta({ layout: 'area', permission: 'orders.read', title: 'Pedido' });

const api = useApi();
const route = useRoute();
const toast = useToast();

const order = ref<Order | null>(null);
const failed = ref(false);
const notFound = ref(false);
const cancelOpen = ref(false);
const reason = ref('');
const canceling = ref(false);

useHead({ title: computed(() => `Pedido ${order.value?.number ?? ''} | Refrigeração Castro`) });

async function load(): Promise<void> {
  failed.value = false;
  try {
    order.value = await unwrap(
      api.GET('/api/v1/orders/{id}', { params: { path: { id: Number(route.params.id) } } }),
    );
  } catch (error) {
    notFound.value = toApiError(error).status === 404;
    failed.value = true;
  }
}

async function cancel(): Promise<void> {
  canceling.value = true;
  try {
    order.value = await unwrap(
      api.POST('/api/v1/orders/{id}/cancellation', {
        params: { path: { id: order.value!.id } },
        body: reason.value.trim() ? { reason: reason.value.trim() } : {},
      }),
    );
    cancelOpen.value = false;
    toast.success({ title: 'Pedido cancelado. Os itens voltaram para a loja.' });
  } catch (error) {
    toast.error({ title: toApiError(error).message });
  } finally {
    canceling.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="mx-auto flex max-w-4xl flex-col gap-5">
    <NuxtLink
      to="/minha-conta/pedidos"
      class="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-link"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      Meus pedidos
    </NuxtLink>

    <ErrorState v-if="failed" :kind="notFound ? 'not-found' : 'server'" :heading-level="2" @retry="load" />

    <div v-else-if="!order" class="grid gap-5 lg:grid-cols-[1fr_20rem]" role="status">
      <span class="sr-only">Carregando o pedido…</span>
      <BaseSkeleton class="h-72 w-full rounded-xl" />
      <BaseSkeleton class="h-56 w-full rounded-xl" />
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-2xl font-extrabold text-text tabular-nums">Pedido {{ order.number }}</h2>
          <p class="text-sm text-text-muted">Feito em {{ formatDateTime(order.createdAt) }}</p>
        </div>
        <BaseStatusBadge kind="order" :status="order.status" />
      </div>
      <p class="rounded-lg bg-surface-sunken p-4 text-text" aria-live="polite">
        {{ ORDER_NEXT_STEP[order.status] }}
      </p>

      <div class="grid items-start gap-5 lg:grid-cols-[1fr_20rem]">
        <div class="flex flex-col gap-5">
          <BaseCard title="Itens" :heading-level="3">
            <OrderItems :order="order" />
          </BaseCard>
          <BaseCard v-if="order.notes" title="Observações" :heading-level="3">
            <p class="whitespace-pre-line text-text">{{ order.notes }}</p>
          </BaseCard>
        </div>
        <div class="flex flex-col gap-5">
          <BaseCard title="Andamento" :heading-level="3">
            <BaseTimeline :events="orderTimeline(order)" label="Andamento do pedido" />
          </BaseCard>
          <div class="flex items-start gap-3 rounded-lg bg-info-soft p-4 text-sm text-on-info-soft">
            <Wallet class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p>Pagamento na retirada, na loja: {{ STORE_INFO.street }}, {{ STORE_INFO.city }}.</p>
          </div>
          <BaseButton v-if="order.canCancel" variant="secondary" @click="cancelOpen = true">
            <Ban class="size-4.5" aria-hidden="true" />
            Cancelar pedido
          </BaseButton>
        </div>
      </div>
    </template>

    <BaseDialog
      v-model:open="cancelOpen"
      title="Cancelar este pedido?"
      description="Os itens voltam para o estoque da loja. Se mudar de ideia, é só fazer um novo pedido."
      size="sm"
    >
      <BaseTextArea v-model="reason" label="Motivo (opcional)" :maxlength="500" :rows="3" />
      <template #footer>
        <BaseButton variant="secondary" @click="cancelOpen = false">Voltar</BaseButton>
        <BaseButton variant="danger" :loading="canceling" @click="cancel">Cancelar pedido</BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>
