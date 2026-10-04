<script setup lang="ts">
import { CalendarPlus, Search } from 'lucide-vue-next';
import { formatDateTime } from '~/utils/masks';
import { REQUESTS_PAGE_SIZE } from '~/utils/service-requests';

/** UC Fila de Solicitações (RF-32): every visit request, filtered by status, searched by customer or number. */
definePageMeta({ layout: 'area', permission: 'serviceRequests.manage', title: 'Solicitações' });
useHead({ title: 'Solicitações | Refrigeração Castro' });

const api = useApi();
const route = useRoute();
const router = useRouter();

const ALL = 'TODOS';
const fromQuery = route.query.estado;
const status = ref<string>(
  fromQuery === ALL || SERVICE_REQUEST_STATUSES.some((value) => value === fromQuery)
    ? (fromQuery as string)
    : 'REQUESTED',
);
const query = ref('');
const searched = ref('');

const statusOptions: SelectOption[] = [
  { value: ALL, label: 'Todos os estados' },
  ...SERVICE_REQUEST_STATUSES.map((value) => ({ value, label: STATUS_META.serviceRequest[value].label })),
];

const columns: TableColumn[] = [
  { key: 'id', label: 'Número' },
  { key: 'customer', label: 'Cliente' },
  { key: 'serviceType', label: 'Serviço' },
  { key: 'status', label: 'Estado' },
  { key: 'createdAt', label: 'Pedida em', priority: 'low' },
];

const { page, rows, pages, loading, failed, load, restart } = usePagedList(async (current) => {
  const q = query.value.trim();
  const result = await unwrap(
    api.GET('/api/v1/service-requests', {
      params: {
        query: {
          status: status.value === ALL ? undefined : (status.value as ServiceRequest['status']),
          q: q || undefined,
          page: current,
          pageSize: REQUESTS_PAGE_SIZE,
        },
      },
    }),
  );
  searched.value = q;
  return result;
}, REQUESTS_PAGE_SIZE);

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
  status.value === ALL ? '' : STATUS_META.serviceRequest[status.value as ServiceRequest['status']].label,
);
</script>

<template>
  <div class="mx-auto flex max-w-6xl flex-col gap-5">
    <div class="grid gap-4 md:grid-cols-[1fr_16rem_auto] md:items-end">
      <BaseTextField
        v-model="query"
        label="Buscar solicitações"
        type="search"
        inputmode="search"
        placeholder="Número ou nome do cliente"
        autocomplete="off"
      >
        <template #prefix><Search class="size-5" aria-hidden="true" /></template>
      </BaseTextField>
      <FormSelect v-model="status" label="Estado" :options="statusOptions" />
      <BaseButton to="/agendar" variant="secondary">
        <CalendarPlus class="size-5" aria-hidden="true" />
        Nova solicitação
      </BaseButton>
    </div>

    <p class="sr-only" role="status">{{ loading ? 'Carregando solicitações…' : '' }}</p>
    <ErrorState v-if="failed" kind="server" :heading-level="2" @retry="load" />
    <BaseResponsiveTable
      v-else
      :columns="columns"
      :rows="rows"
      row-key="id"
      caption="Solicitações de visita"
      :loading="loading"
    >
      <template #cell-id="{ row }">
        <NuxtLink
          :to="`/solicitacoes/${row.id}`"
          class="font-semibold text-link tabular-nums underline-offset-4 hover:underline"
          >Solicitação {{ row.id }}</NuxtLink
        >
      </template>
      <template #cell-customer="{ row }">{{ row.customer.name }}</template>
      <template #cell-serviceType="{ row }">
        {{ row.serviceType }}
        <span class="block text-sm text-text-muted">{{ row.productKind }}</span>
      </template>
      <template #cell-status="{ row }">
        <BaseStatusBadge kind="serviceRequest" :status="row.status" size="sm" />
      </template>
      <template #cell-createdAt="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      <template #empty>
        <BaseEmptyState
          v-if="searched"
          :title="`Nada encontrado para “${searched}”`"
          text="Busque pelo número da solicitação ou pelo nome do cliente."
        />
        <BaseEmptyState
          v-else
          :title="statusLabel ? `Nenhuma solicitação: ${statusLabel.toLowerCase()}` : 'Nenhuma solicitação'"
          text="Quando um cliente pedir uma visita, ela aparece aqui."
        />
      </template>
    </BaseResponsiveTable>
    <BasePagination v-if="!failed" v-model:page="page" :total="pages" label="Páginas de solicitações" />
  </div>
</template>
