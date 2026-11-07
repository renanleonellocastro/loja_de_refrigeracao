<script setup lang="ts">
import { Store } from 'lucide-vue-next';
import { ON_BEHALF_WORDING, type OrderDraft } from '~/utils/counter';
import { STORE_INFO } from '~/utils/store';

/**
 * UC Comprar Produto on behalf of a customer (RF-19): the store places an online order for a customer who asked
 * by phone or WhatsApp. The stock is reserved and the order waits in the queue until the customer picks it up.
 */
definePageMeta({ layout: 'area', permission: 'orders.manage', title: 'Novo pedido' });
useHead({ title: 'Novo pedido | Refrigeração Castro' });

const api = useApi();

const placed = ref<Order | null>(null);
/** A new builder for every order, so nothing of the last one stays on screen. */
const round = ref(0);

function postOrder(draft: OrderDraft, idempotencyKey: string) {
  return api.POST('/api/v1/orders', { body: draft, headers: { 'Idempotency-Key': idempotencyKey } });
}

function startOver(): void {
  placed.value = null;
  round.value += 1;
}
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <OrderPlaced v-if="placed" :order="placed" title="Pedido fechado!">
      Os itens ficaram reservados e o pedido está na fila esperando separação. O cliente recebe o aviso e paga
      na retirada.
      <template #actions>
        <BaseButton variant="secondary" :to="`/pedidos/${placed.id}`">Ver pedido</BaseButton>
        <BaseButton @click="startOver">Novo pedido</BaseButton>
      </template>
    </OrderPlaced>

    <OrderBuilder
      v-else
      :key="round"
      :wording="ON_BEHALF_WORDING"
      :submit="postOrder"
      @placed="placed = $event"
    >
      <template #notice>
        <p class="flex items-start gap-2 rounded-lg bg-info-soft p-3 text-sm text-on-info-soft">
          <Store class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>Retirada na loja.</strong> O estoque fica reservado para o cliente, que paga quando vier
            buscar na {{ STORE_INFO.street }}.
          </span>
        </p>
      </template>
    </OrderBuilder>
  </div>
</template>
