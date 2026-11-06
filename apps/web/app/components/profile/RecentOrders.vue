<script setup lang="ts">
import { formatDate, formatMoney } from '~/utils/masks';

/** Last orders of the customer on the profile, with a link to the full list. */
const api = useApi();
const { rows, loading, failed } = useRecentList((pageSize) =>
  unwrap(api.GET('/api/v1/orders', { params: { query: { pageSize } } })),
);
</script>

<template>
  <ProfileRecentCard
    title="Últimos pedidos"
    all-to="/minha-conta/pedidos"
    empty-text="Nenhum pedido ainda."
    start-to="/produtos"
    start-label="Ver produtos"
    :loading="loading"
    :failed="failed"
    :empty="rows.length === 0"
  >
    <ProfileRecentRow
      v-for="order in rows"
      :key="order.id"
      :to="`/minha-conta/pedidos/${order.id}`"
      :title="`Pedido ${order.number}`"
      :details="`${formatDate(order.createdAt)} · ${formatMoney(order.totalCents)}`"
    >
      <template #status><BaseStatusBadge kind="order" :status="order.status" size="sm" /></template>
    </ProfileRecentRow>
  </ProfileRecentCard>
</template>
