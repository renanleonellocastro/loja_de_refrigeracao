<script setup lang="ts">
import { ChevronRight, ReceiptText } from 'lucide-vue-next';
import { formatDate, formatMoney } from '~/utils/masks';
import { formatValidUntil, QUOTES_PAGE_SIZE } from '~/utils/quotes';

/** Meus orçamentos: the quotes of the signed in customer, newest first. */
definePageMeta({ layout: 'area', permission: 'quotes.decide', title: 'Meus orçamentos' });
useHead({ title: 'Meus orçamentos | Refrigeração Castro' });

const api = useApi();

const { page, rows, pages, loading, failed, load } = usePagedList(
  (current) =>
    unwrap(api.GET('/api/v1/quotes', { params: { query: { page: current, pageSize: QUOTES_PAGE_SIZE } } })),
  QUOTES_PAGE_SIZE,
);

onMounted(load);
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-5">
    <div class="flex justify-end">
      <BaseButton to="/orcamento">
        <ReceiptText class="size-5" aria-hidden="true" />
        Pedir orçamento
      </BaseButton>
    </div>

    <ErrorState v-if="failed" kind="server" :heading-level="2" @retry="load" />

    <div v-else-if="loading" class="flex flex-col gap-3" role="status">
      <span class="sr-only">Carregando orçamentos…</span>
      <BaseSkeleton v-for="n in 3" :key="n" class="h-24 w-full rounded-xl" />
    </div>

    <BaseEmptyState
      v-else-if="rows.length === 0"
      title="Nenhum orçamento"
      text="Quando você pedir um orçamento, ele aparece aqui com o valor e a validade."
    >
      <template #illustration>
        <img src="/illustrations/vazio-pedidos.svg" alt="" width="240" height="180" class="h-36 w-auto" />
      </template>
      <template #action><BaseButton to="/servicos">Ver serviços</BaseButton></template>
    </BaseEmptyState>

    <template v-else>
      <ul class="flex flex-col gap-3" aria-label="Orçamentos">
        <li v-for="quote in rows" :key="quote.id">
          <NuxtLink
            :to="`/minha-conta/orcamentos/${quote.id}`"
            class="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary hover:bg-surface-sunken"
          >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span class="font-bold text-text">{{ quote.serviceType }}</span>
                <BaseStatusBadge kind="quote" :status="quote.status" size="sm" />
              </div>
              <p class="mt-1 text-sm text-text-muted">
                Orçamento {{ quote.id }} · {{ formatDate(quote.createdAt) }}
              </p>
              <p v-if="quote.amountCents !== null" class="mt-1 text-sm font-semibold text-text">
                {{ formatMoney(quote.amountCents) }}
                <span v-if="quote.status === 'ANSWERED'" class="font-normal text-text-muted">
                  · válido até {{ formatValidUntil(quote.validUntil!) }}
                </span>
              </p>
            </div>
            <ChevronRight class="size-5 shrink-0 text-text-muted" aria-hidden="true" />
          </NuxtLink>
        </li>
      </ul>
      <BasePagination v-model:page="page" :total="pages" label="Páginas de orçamentos" />
    </template>
  </div>
</template>
