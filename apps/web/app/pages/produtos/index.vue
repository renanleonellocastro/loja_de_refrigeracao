<script setup lang="ts">
import { Search, SlidersHorizontal, X } from 'lucide-vue-next';
import { CONDITION_LABELS, countLabel } from '~/utils/catalog';

/** UC Consultar Produtos (RF-20, D1): public catalog rendered on the server, with every filter in the address. */
const route = useRoute();
const router = useRouter();
const api = useApi();

const filters = computed(() => filtersFromQuery(route.query));
const search = ref(filters.value.q);
watch(
  () => filters.value.q,
  (q) => {
    search.value = q;
  },
);
const filtersOpen = ref(false);

const CHIP =
  'inline-flex min-h-9 items-center gap-1.5 rounded-full bg-info-soft px-3 text-sm font-semibold text-on-info-soft transition-colors hover:bg-info-soft/70';

const { data, status, refresh } = await useAsyncData(
  'catalog',
  async () => {
    const [products, facets] = await Promise.all([
      unwrap(api.GET('/api/v1/products', { params: { query: productParams(filters.value) } })),
      unwrap(api.GET('/api/v1/products/facets', { params: { query: facetParams(filters.value) } })),
    ]);
    return { products, facets };
  },
  { watch: [filters] },
);

const products = computed(() => data.value?.products.data ?? []);
const facets = computed(() => data.value?.facets ?? null);
const total = computed(() => data.value?.products.meta.total ?? 0);
const pages = computed(() => Math.ceil(total.value / CATALOG_PAGE_SIZE));
const activeCount = computed(() => activeFilterCount(filters.value));
const categoryName = computed(
  () => data.value?.facets.categories.find((item) => item.categoryId === filters.value.categoryId)?.name,
);

function go(changes: Partial<CatalogFilters>): void {
  // Any change other than the page starts the list again from the first page.
  const next = { ...filters.value, page: 1, ...changes };
  void router.push({ path: '/produtos', query: queryFromFilters(next) });
}

function clearFilters(): void {
  filtersOpen.value = false;
  void router.push({
    path: '/produtos',
    query: queryFromFilters({ ...filtersFromQuery({}), q: filters.value.q }),
  });
}

function submitSearch(): void {
  go({ q: search.value.trim() });
}

const page = computed({
  get: () => filters.value.page,
  set: (value: number) => {
    go({ page: value });
    // Only a click changes the page, so this runs in the browser.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
});

const sort = computed({
  get: () => filters.value.sort || (filters.value.q ? 'relevancia' : 'recentes'),
  set: (value: string) => go({ sort: value }),
});
const sortOptions = computed(() =>
  SORT_OPTIONS.filter((option) => option.value !== 'relevancia' || filters.value.q),
);

const heading = computed(() => {
  if (filters.value.q) return `Resultados para “${filters.value.q}”`;
  return categoryName.value ?? 'Produtos';
});

const title = computed(() => {
  const base = filters.value.q ? `Busca: ${filters.value.q}` : (categoryName.value ?? 'Produtos');
  return `${base}${filters.value.page > 1 ? `, página ${filters.value.page}` : ''} | Refrigeração Castro`;
});
useSeoMeta({
  title,
  description:
    'Geladeiras, freezers, ar condicionado, lavadoras, bebedouros e peças, novos e revisados, na Refrigeração Castro em Mogi Mirim/SP. Reserve pelo site e retire na loja.',
  ogTitle: title,
  ogImage: `${useRequestURL().origin}/og-image.png`,
  // Searches and filtered pages are thin variations of the catalog; only the plain list is indexed.
  robots: computed(() => (filters.value.q || activeCount.value > 0 ? 'noindex, follow' : 'index, follow')),
});
</script>

<template>
  <div class="rc-container py-6 sm:py-10">
    <BaseBreadcrumbs :items="[{ label: 'Início', to: '/' }, { label: 'Produtos' }]" />
    <div class="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 class="text-3xl font-extrabold text-text sm:text-4xl">{{ heading }}</h1>
        <p class="mt-1 text-text-muted" aria-live="polite">
          <template v-if="status === 'pending'">Procurando produtos…</template>
          <template v-else>{{ countLabel(total, 'produto encontrado', 'produtos encontrados') }}</template>
        </p>
      </div>
      <form role="search" class="flex w-full gap-2 lg:max-w-md" @submit.prevent="submitSearch">
        <BaseTextField
          v-model="search"
          label="Buscar produtos"
          hide-label
          type="search"
          inputmode="search"
          placeholder="Buscar geladeira, ar condicionado, peça…"
          class="flex-1"
        >
          <template #prefix><Search class="size-4.5" aria-hidden="true" /></template>
        </BaseTextField>
        <BaseButton type="submit">Buscar</BaseButton>
      </form>
    </div>

    <div class="mt-6 grid gap-8 lg:grid-cols-[16rem_1fr]">
      <aside class="hidden lg:block" aria-label="Filtros">
        <div class="sticky top-24">
          <CatalogFilters
            :filters="filters"
            :facets="facets"
            id-prefix="lateral"
            @change="go"
            @clear="clearFilters"
          />
        </div>
      </aside>

      <section aria-label="Lista de produtos" class="min-w-0">
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <BaseButton
            variant="secondary"
            class="lg:hidden"
            aria-haspopup="dialog"
            :aria-expanded="filtersOpen"
            @click="filtersOpen = true"
          >
            <SlidersHorizontal class="size-4.5" aria-hidden="true" />
            Filtros<template v-if="activeCount > 0"> ({{ activeCount }})</template>
          </BaseButton>
          <label class="ml-auto flex items-center gap-2 text-sm text-text-muted">
            Ordenar por
            <select
              v-model="sort"
              class="h-11 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-text"
            >
              <option v-for="option in sortOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>

        <ul
          v-if="filters.brand || filters.condition || categoryName"
          class="mb-4 flex flex-wrap gap-2"
          aria-label="Filtros ativos"
        >
          <li v-if="categoryName">
            <button type="button" :class="CHIP" @click="go({ categoryId: undefined })">
              {{ categoryName }} <X class="size-3.5" aria-hidden="true" /><span class="sr-only"
                >, remover filtro</span
              >
            </button>
          </li>
          <li v-if="filters.condition">
            <button type="button" :class="CHIP" @click="go({ condition: undefined })">
              {{ CONDITION_LABELS[filters.condition] }} <X class="size-3.5" aria-hidden="true" /><span
                class="sr-only"
                >, remover filtro</span
              >
            </button>
          </li>
          <li v-if="filters.brand">
            <button type="button" :class="CHIP" @click="go({ brand: undefined })">
              {{ filters.brand }} <X class="size-3.5" aria-hidden="true" /><span class="sr-only"
                >, remover filtro</span
              >
            </button>
          </li>
        </ul>

        <ErrorState v-if="status === 'error'" kind="server" :heading-level="2" @retry="refresh" />

        <div
          v-else-if="status === 'pending' && products.length === 0"
          class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
          role="status"
        >
          <span class="sr-only">Carregando produtos…</span>
          <BaseSkeleton v-for="n in 8" :key="n" class="aspect-[3/4] w-full rounded-xl" />
        </div>

        <BaseEmptyState
          v-else-if="products.length === 0"
          title="Nenhum produto encontrado"
          text="Confira a escrita ou tire alguns filtros. Se não achar o que procura, fale com a gente no WhatsApp."
        >
          <template #illustration>
            <img src="/illustrations/vazio-busca.svg" alt="" width="240" height="180" class="h-36 w-auto" />
          </template>
          <template v-if="filters.q || activeCount > 0" #action>
            <BaseButton variant="secondary" to="/produtos">Ver todos os produtos</BaseButton>
          </template>
        </BaseEmptyState>

        <template v-else>
          <ul
            class="grid grid-cols-2 gap-3 transition-opacity sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
            :class="{ 'opacity-60': status === 'pending' }"
          >
            <li v-for="(product, index) in products" :key="product.id">
              <CatalogProductCard :product="product" :eager="index < 4" />
            </li>
          </ul>
          <BasePagination v-model:page="page" :total="pages" label="Páginas de produtos" class="mt-8" />
        </template>
      </section>
    </div>

    <BaseDialog v-model:open="filtersOpen" title="Filtros">
      <CatalogFilters
        :filters="filters"
        :facets="facets"
        id-prefix="gaveta"
        @change="go"
        @clear="clearFilters"
      />
      <template #footer>
        <BaseButton block @click="filtersOpen = false">
          Ver {{ countLabel(total, 'produto', 'produtos') }}
        </BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>
