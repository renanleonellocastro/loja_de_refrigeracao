<script setup lang="ts">
import { formatDate, formatMoney } from '~/utils/masks';

/** Last quotes of the customer on the profile, with a link to "Meus orçamentos". */
const api = useApi();
const { rows, loading, failed } = useRecentList((pageSize) =>
  unwrap(api.GET('/api/v1/quotes', { params: { query: { pageSize } } })),
);

function details(quote: QuoteListItem): string {
  const day = formatDate(quote.createdAt);
  return quote.amountCents === null ? day : `${day} · ${formatMoney(quote.amountCents)}`;
}
</script>

<template>
  <ProfileRecentCard
    title="Últimos orçamentos"
    all-to="/minha-conta/orcamentos"
    empty-text="Nenhum orçamento ainda."
    start-to="/orcamento"
    start-label="Pedir orçamento"
    :loading="loading"
    :failed="failed"
    :empty="rows.length === 0"
  >
    <ProfileRecentRow
      v-for="quote in rows"
      :key="quote.id"
      :to="`/minha-conta/orcamentos/${quote.id}`"
      :title="quote.serviceType"
      :details="details(quote)"
    >
      <template #status><BaseStatusBadge kind="quote" :status="quote.status" size="sm" /></template>
    </ProfileRecentRow>
  </ProfileRecentCard>
</template>
