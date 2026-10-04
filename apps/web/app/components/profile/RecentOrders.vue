<script setup lang="ts">
import { formatDate, formatMoney } from '~/utils/masks';

/** Last three orders on the profile of a customer, with a link to the full list. Hidden when there are none. */
const api = useApi();
const orders = ref<OrderListItem[]>([]);

onMounted(async () => {
  try {
    orders.value = (await unwrap(api.GET('/api/v1/orders', { params: { query: { pageSize: 3 } } }))).data;
  } catch {
    // A convenience on the profile: without it the page still works.
  }
});
</script>

<template>
  <BaseCard v-if="orders.length > 0" title="Últimos pedidos" :heading-level="2">
    <template #actions>
      <NuxtLink to="/minha-conta/pedidos" class="text-sm font-semibold text-link hover:underline"
        >Ver todos</NuxtLink
      >
    </template>
    <ul class="divide-y divide-border">
      <li v-for="order in orders" :key="order.id">
        <NuxtLink
          :to="`/minha-conta/pedidos/${order.id}`"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:text-link"
        >
          <span class="font-semibold tabular-nums">Pedido {{ order.number }}</span>
          <BaseStatusBadge kind="order" :status="order.status" size="sm" />
          <span class="ml-auto text-sm text-text-muted tabular-nums">
            {{ formatDate(order.createdAt) }} · {{ formatMoney(order.totalCents) }}
          </span>
        </NuxtLink>
      </li>
    </ul>
  </BaseCard>
</template>
