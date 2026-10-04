<script setup lang="ts">
import { Search } from 'lucide-vue-next';
import { formatDateTime, formatMoney } from '~/utils/masks';

/** UC Fila de Pedidos (RF-25): one tab per status with its count, search by number or customer. */
definePageMeta({ layout: 'area', permission: 'orders.manage', title: 'Pedidos' });
useHead({ title: 'Pedidos | Refrigeração Castro' });

const api = useApi();
const route = useRoute();
const router = useRouter();

const initial = ORDER_STATUSES.find((status) => status === route.query.estado) ?? 'PENDING_REVIEW';
const status = ref<OrderStatus>(initial);
const query = ref('');
const searched = ref('');
const counts = ref<Record<string, number> | null>(null);

const tabs = computed<TabItem[]>(() =>
  ORDER_STATUSES.map((value) => ({
    value,
    label: STATUS_META.order[value].label,
    count: counts.value?.[value],
  })),
);

const columns: TableColumn[] = [
  { key: 'number', label: 'Pedido' },
  { key: 'customer', label: 'Cliente' },
  { key: 'itemCount', label: 'Itens', align: 'end', priority: 'low' },
  { key: 'totalCents', label: 'Total', align: 'end' },
  { key: 'createdAt', label: 'Feito em' },
];

const { page, rows, pages, loading, failed, load, restart } = usePagedList(async (current) => {
  const q = query.value.trim();
  const result = await unwrap(
    api.GET('/api/v1/orders', {
      params: {
        query: { status: status.value, q: q || undefined, page: current, pageSize: ORDERS_PAGE_SIZE },
      },
    }),
  );
  counts.value = result.meta.counts;
  searched.value = q;
  return result;
}, ORDERS_PAGE_SIZE);

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

const emptyText: Record<OrderStatus, string> = {
  PENDING_REVIEW: 'Nenhum pedido esperando separação. Quando um cliente fechar um pedido, ele aparece aqui.',
  READY_FOR_PICKUP: 'Nenhum pedido esperando o cliente passar na loja.',
  PICKED_UP: 'Nenhum pedido retirado ainda.',
  CANCELED: 'Nenhum pedido cancelado. Ótimo sinal!',
};
</script>

<template>
  <div class="mx-auto flex max-w-6xl flex-col gap-5">
    <BaseTextField
      v-model="query"
      label="Buscar pedidos"
      type="search"
      inputmode="search"
      placeholder="Número do pedido ou nome do cliente"
      autocomplete="off"
    >
      <template #prefix><Search class="size-5" aria-hidden="true" /></template>
    </BaseTextField>

    <BaseTabs v-model="status" :tabs="tabs" label="Pedidos por estado">
      <template v-for="tab in tabs" :key="tab.value" #[tab.value]>
        <p class="sr-only" role="status">{{ loading ? 'Carregando pedidos…' : '' }}</p>
        <ErrorState v-if="failed" kind="server" :heading-level="2" @retry="load" />
        <BaseResponsiveTable
          v-else
          :columns="columns"
          :rows="rows"
          row-key="id"
          :caption="`Pedidos: ${tab.label}`"
          :loading="loading"
        >
          <template #cell-number="{ row }">
            <NuxtLink
              :to="`/pedidos/${row.id}`"
              class="font-semibold text-link tabular-nums underline-offset-4 hover:underline"
              >Pedido {{ row.number }}</NuxtLink
            >
            <span
              v-if="row.channel === 'COUNTER'"
              class="ml-2 rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-semibold text-text-muted"
              >Balcão</span
            >
          </template>
          <template #cell-customer="{ row }">{{ row.customer.name }}</template>
          <template #cell-totalCents="{ row }">{{ formatMoney(row.totalCents) }}</template>
          <template #cell-createdAt="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          <template #empty>
            <BaseEmptyState
              v-if="searched"
              :title="`Nada encontrado para “${searched}”`"
              text="Busque pelo número do pedido ou pelo nome do cliente."
            />
            <BaseEmptyState
              v-else
              :title="`Nenhum pedido ${tab.label.toLowerCase()}`"
              :text="emptyText[status]"
            />
          </template>
        </BaseResponsiveTable>
        <div class="mt-5">
          <BasePagination v-if="!failed" v-model:page="page" :total="pages" label="Páginas de pedidos" />
        </div>
      </template>
    </BaseTabs>
  </div>
</template>
