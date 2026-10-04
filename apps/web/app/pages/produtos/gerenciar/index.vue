<script setup lang="ts">
import { PackagePlus, Search } from 'lucide-vue-next';
import { CONDITION_LABELS } from '~/utils/catalog';
import { formatMoney } from '~/utils/masks';

/** UCs Listar e Buscar Produtos da equipe (RF-12): search, filters, archived products and low stock. */
definePageMeta({ layout: 'area', permission: 'products.manage', title: 'Produtos' });
useHead({ title: 'Produtos | Refrigeração Castro' });

const api = useApi();

const query = ref('');
const categoryId = ref('');
const condition = ref('');
const onlyAvailable = ref(false);
const includeArchived = ref(false);
const categories = ref<Category[]>([]);
const searched = ref(false);

const categoryOptions = computed<SelectOption[]>(() => [
  { value: '', label: 'Todas as categorias' },
  ...categories.value.map((category) => ({ value: String(category.id), label: category.name })),
]);
const conditionOptions: SelectOption[] = [{ value: '', label: 'Novos e usados' }, ...CONDITION_OPTIONS];

const columns: TableColumn[] = [
  { key: 'name', label: 'Produto' },
  { key: 'categoryName', label: 'Categoria', priority: 'low' },
  { key: 'condition', label: 'Condição', priority: 'low' },
  { key: 'priceCents', label: 'Preço', align: 'end' },
  { key: 'stockAvailable', label: 'Estoque', align: 'end' },
];

const { page, rows, total, pages, loading, failed, load, restart } = usePagedList(async (current) => {
  const q = query.value.trim();
  const result = await unwrap(
    api.GET('/api/v1/products', {
      params: {
        query: {
          q: q || undefined,
          categoryId: categoryId.value ? Number(categoryId.value) : undefined,
          condition: (condition.value || undefined) as Condition | undefined,
          available: onlyAvailable.value ? 'true' : undefined,
          includeArchived: includeArchived.value ? 'true' : undefined,
          sort: q ? 'relevance' : 'name',
          page: current,
          pageSize: PRODUCTS_PAGE_SIZE,
        },
      },
    }),
  );
  searched.value = Boolean(q || categoryId.value || condition.value || onlyAvailable.value);
  return result;
}, PRODUCTS_PAGE_SIZE);

let timer: ReturnType<typeof setTimeout> | undefined;
watch(query, () => {
  clearTimeout(timer);
  timer = setTimeout(restart, SEARCH_DEBOUNCE_MS);
});
watch([categoryId, condition, onlyAvailable, includeArchived], restart);
onBeforeUnmount(() => clearTimeout(timer));

onMounted(async () => {
  void load();
  try {
    categories.value = await unwrap(api.GET('/api/v1/categories'));
  } catch {
    // The list still works without the category filter.
  }
});

function clearFilters(): void {
  query.value = '';
  categoryId.value = '';
  condition.value = '';
  onlyAvailable.value = false;
}
</script>

<template>
  <div class="mx-auto flex max-w-6xl flex-col gap-5">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div class="flex-1">
        <BaseTextField
          v-model="query"
          label="Buscar produtos"
          type="search"
          inputmode="search"
          placeholder="Nome, marca ou modelo"
          autocomplete="off"
        >
          <template #prefix><Search class="size-5" aria-hidden="true" /></template>
        </BaseTextField>
      </div>
      <BaseButton to="/produtos/gerenciar/novo" class="sm:mb-px">
        <PackagePlus class="size-5" aria-hidden="true" />
        Cadastrar produto
      </BaseButton>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
      <FormSelect v-model="categoryId" label="Categoria" :options="categoryOptions" />
      <FormSelect v-model="condition" label="Condição" :options="conditionOptions" />
      <BaseSwitch v-model="onlyAvailable" label="Só com estoque" />
      <BaseSwitch v-model="includeArchived" label="Mostrar arquivados" />
    </div>

    <p class="sr-only" role="status">
      {{ loading ? 'Carregando produtos…' : `${total} produtos encontrados` }}
    </p>

    <ErrorState v-if="failed" kind="server" :heading-level="2" @retry="load" />

    <BaseResponsiveTable
      v-else
      :columns="columns"
      :rows="rows"
      row-key="id"
      caption="Lista de produtos"
      :loading="loading"
    >
      <template #cell-name="{ row }">
        <span class="flex items-center gap-3">
          <span class="size-12 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
            <CatalogProductImage :image="row.cover" alt="" sizes="48px" />
          </span>
          <span class="flex min-w-0 flex-col gap-1">
            <NuxtLink
              :to="`/produtos/gerenciar/${row.id}`"
              class="font-semibold text-link underline-offset-4 hover:underline"
              >{{ row.name }}</NuxtLink
            >
            <ProductsBadges :product="row" />
          </span>
        </span>
      </template>
      <template #cell-condition="{ row }">{{ CONDITION_LABELS[row.condition] }}</template>
      <template #cell-priceCents="{ row }">{{ formatMoney(row.priceCents) }}</template>
      <template #cell-stockAvailable="{ row }">
        <span :class="row.lowStock ? 'font-semibold text-on-warning-soft' : ''">{{
          row.stockAvailable
        }}</span>
      </template>
      <template #empty>
        <BaseEmptyState
          v-if="searched"
          title="Nenhum produto com esses filtros"
          text="Confira a grafia ou limpe os filtros para ver tudo."
        >
          <template #action>
            <BaseButton variant="secondary" @click="clearFilters">Limpar filtros</BaseButton>
          </template>
        </BaseEmptyState>
        <BaseEmptyState
          v-else
          title="Nenhum produto cadastrado"
          text="Cadastre o primeiro produto e ele aparece no catálogo da loja na hora."
        >
          <template #action>
            <BaseButton to="/produtos/gerenciar/novo">Cadastrar produto</BaseButton>
          </template>
        </BaseEmptyState>
      </template>
    </BaseResponsiveTable>

    <BasePagination v-if="!failed" v-model:page="page" :total="pages" label="Páginas de produtos" />
  </div>
</template>
