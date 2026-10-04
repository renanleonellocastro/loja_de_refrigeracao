<script setup lang="ts">
import { CircleCheck, Wallet } from 'lucide-vue-next';
import { STORE_INFO } from '~/utils/store';
import { ORDER_NEXT_STEP } from '~/utils/orders';

/** UC Comprar Produto, last step: confirmation with the order number and what happens next. */
definePageMeta({ permission: 'orders.read' });
useSeoMeta({ title: 'Pedido recebido | Refrigeração Castro', robots: 'noindex, nofollow' });

const api = useApi();
const route = useRoute();

const order = ref<Order | null>(null);
const failed = ref(false);

async function load(): Promise<void> {
  failed.value = false;
  try {
    order.value = await unwrap(
      api.GET('/api/v1/orders/{id}', { params: { path: { id: Number(route.params.id) } } }),
    );
  } catch {
    failed.value = true;
  }
}

onMounted(load);
</script>

<template>
  <div class="rc-container max-w-2xl py-8 sm:py-14">
    <ErrorState v-if="failed" kind="server" :heading-level="1" @retry="load" />

    <div v-else-if="!order" class="flex flex-col items-center gap-4" role="status">
      <span class="sr-only">Carregando o pedido…</span>
      <BaseSkeleton class="size-16 rounded-full" />
      <BaseSkeleton class="h-8 w-72 max-w-full rounded-sm" />
      <BaseSkeleton class="h-64 w-full rounded-xl" />
    </div>

    <template v-else>
      <div class="flex flex-col items-center text-center">
        <span
          class="flex size-16 items-center justify-center rounded-full bg-success-soft text-on-success-soft"
        >
          <CircleCheck class="size-9" aria-hidden="true" />
        </span>
        <h1 class="mt-4 text-3xl font-extrabold text-text">Pronto! Recebemos seu pedido.</h1>
        <p class="mt-2 text-lg text-text-muted">
          Número do pedido:
          <strong class="text-text tabular-nums" data-testid="order-number">{{ order.number }}</strong>
        </p>
        <p class="mt-2 max-w-md text-text-muted">{{ ORDER_NEXT_STEP[order.status] }}</p>
      </div>

      <BaseCard class="mt-8" title="Resumo" :heading-level="2">
        <OrderItems :order="order" />
      </BaseCard>

      <div class="mt-4 flex items-start gap-3 rounded-lg bg-info-soft p-4 text-sm text-on-info-soft">
        <Wallet class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p>
          O pagamento é feito na loja, na retirada: {{ STORE_INFO.street }}, {{ STORE_INFO.city }}.
          {{ STORE_INFO.hours }}.
        </p>
      </div>

      <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <BaseButton :to="`/minha-conta/pedidos/${order.id}`">Acompanhar pedido</BaseButton>
        <BaseButton variant="secondary" to="/produtos">Continuar comprando</BaseButton>
      </div>
    </template>
  </div>
</template>
