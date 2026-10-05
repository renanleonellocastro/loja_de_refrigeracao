<script setup lang="ts">
import { ReceiptText, Search } from 'lucide-vue-next';
import { formatDateTime, formatMoney } from '~/utils/masks';
import { QUOTES_PAGE_SIZE } from '~/utils/quotes';

/** UC Responder Orçamento, the queue: every quote, filtered by status, searched by customer or number. */
definePageMeta({ layout: 'area', permission: 'quotes.answer', title: 'Orçamentos' });
useHead({ title: 'Orçamentos | Refrigeração Castro' });

const api = useApi();
const route = useRoute();
const router = useRouter();

const ALL = 'TODOS';
const fromQuery = route.query.estado;
const status = ref<string>(
  fromQuery === ALL || QUOTE_STATUSES.some((value) => value === fromQuery)
    ? (fromQuery as string)
    : 'REQUESTED',
);
const query = ref('');
const searched = ref('');

const statusOptions: SelectOption[] = [
  { value: ALL, label: 'Todos os estados' },
  ...QUOTE_STATUSES.map((value) => ({ value, label: STATUS_META.quote[value].label })),
];

const columns: TableColumn[] = [
  { key: 'id', label: 'Número' },
  { key: 'customer', label: 'Cliente' },
  { key: 'serviceType', label: 'Serviço' },
  { key: 'status', label: 'Estado' },
  { key: 'amountCents', label: 'Valor', align: 'end', priority: 'low' },
  { key: 'createdAt', label: 'Pedido em', priority: 'low' },
];

const { page, rows, pages, loading, failed, load, restart } = usePagedList(async (current) => {
  const q = query.value.trim();
  const result = await unwrap(
    api.GET('/api/v1/quotes', {
      params: {
        query: {
          status: status.value === ALL ? undefined : status.value,
          q: q || undefined,
          page: current,
          pageSize: QUOTES_PAGE_SIZE,
        },
      },
    }),
  );
  searched.value = q;
  return result;
}, QUOTES_PAGE_SIZE);

let timer: ReturnType<typeof setTimeout> | undefined;
watch(query, () => {
  clearTimeout(timer);
  timer = setTimeout(restart, SEARCH_DEBOUNCE_MS);
});
watch(status, (value) => {
  void router.replace({ query: { ...route.query, estado: value } });
  restart();
});
onBeforeUnmount(() => clearTimeout(timer));
onMounted(load);

const statusLabel = computed(() =>
  status.value === ALL ? '' : STATUS_META.quote[status.value as QuoteStatus].label,
);
</script>

<template>
  <div class="mx-auto flex max-w-6xl flex-col gap-5">
    <div class="grid gap-4 md:grid-cols-[1fr_16rem_auto] md:items-end">
      <BaseTextField
        v-model="query"
        label="Buscar orçamentos"
        type="search"
        inputmode="search"
        placeholder="Número ou nome do cliente"
        autocomplete="off"
      >
        <template #prefix><Search class="size-5" aria-hidden="true" /></template>
      </BaseTextField>
      <FormSelect v-model="status" label="Estado" :options="statusOptions" />
      <BaseButton to="/orcamento" variant="secondary">
        <ReceiptText class="size-5" aria-hidden="true" />
        Novo orçamento
      </BaseButton>
    </div>

    <p class="sr-only" role="status">{{ loading ? 'Carregando orçamentos…' : '' }}</p>
    <ErrorState v-if="failed" kind="server" :heading-level="2" @retry="load" />
    <BaseResponsiveTable
      v-else
      :columns="columns"
      :rows="rows"
      row-key="id"
      caption="Orçamentos"
      :loading="loading"
    >
      <template #cell-id="{ row }">
        <NuxtLink
          :to="`/orcamentos/${row.id}`"
          class="font-semibold text-link tabular-nums underline-offset-4 hover:underline"
          >Orçamento {{ row.id }}</NuxtLink
        >
      </template>
      <template #cell-customer="{ row }">{{ row.customer.name }}</template>
      <template #cell-serviceType="{ row }">{{ row.serviceType }}</template>
      <template #cell-status="{ row }">
        <BaseStatusBadge kind="quote" :status="row.status" size="sm" />
      </template>
      <template #cell-amountCents="{ row }">
        <span class="tabular-nums">{{
          row.amountCents === null ? 'A responder' : formatMoney(row.amountCents)
        }}</span>
      </template>
      <template #cell-createdAt="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      <template #empty>
        <BaseEmptyState
          v-if="searched"
          :title="`Nada encontrado para “${searched}”`"
          text="Busque pelo número do orçamento ou pelo nome do cliente."
        />
        <BaseEmptyState
          v-else
          :title="statusLabel ? `Nenhum orçamento: ${statusLabel.toLowerCase()}` : 'Nenhum orçamento'"
          text="Quando um cliente pedir um orçamento, ele aparece aqui."
        />
      </template>
    </BaseResponsiveTable>
    <BasePagination v-if="!failed" v-model:page="page" :total="pages" label="Páginas de orçamentos" />
  </div>
</template>
