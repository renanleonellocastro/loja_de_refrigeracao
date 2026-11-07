<script setup lang="ts">
import { can } from '@rc/contracts';
import { COUNTER_WORDING, type OrderDraft } from '~/utils/counter';

/** UC Venda no Balcão (RF-26): the sale is picked up and paid on the spot, so stock leaves right away. */
definePageMeta({ layout: 'area', permission: 'counterSales.create', title: 'Venda no balcão' });
useHead({ title: 'Venda no balcão | Refrigeração Castro' });

const api = useApi();
const auth = useAuthStore();
const canOpenOrders = computed(() => can(auth.actor, 'orders.manage'));

const sale = ref<Order | null>(null);
/** A new builder for every sale, so nothing of the last one stays on screen. */
const round = ref(0);

function postSale(draft: OrderDraft, idempotencyKey: string) {
  return api.POST('/api/v1/counter-sales', { body: draft, headers: { 'Idempotency-Key': idempotencyKey } });
}

function startOver(): void {
  sale.value = null;
  round.value += 1;
}
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <OrderPlaced v-if="sale" :order="sale" title="Venda registrada!">
      O estoque já foi atualizado.
      <template #actions>
        <BaseButton v-if="canOpenOrders" variant="secondary" :to="`/pedidos/${sale.id}`"
          >Ver pedido</BaseButton
        >
        <BaseButton @click="startOver">Nova venda</BaseButton>
      </template>
    </OrderPlaced>

    <OrderBuilder v-else :key="round" :wording="COUNTER_WORDING" :submit="postSale" @placed="sale = $event" />
  </div>
</template>
