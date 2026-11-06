<script setup lang="ts">
import { Plus, Search, Trash2 } from 'lucide-vue-next';
import { holdWhile, runOrToast } from '~/composables/useScreenAction';
import type { ApiError, ApiResult } from '~/utils/api-error';
import { countLabel } from '~/utils/catalog';
import {
  addToCounter,
  counterLimit,
  counterTotal,
  draftOf,
  COUNTER_SEARCH_SIZE,
  type BuilderWording,
  type OrderDraft,
} from '~/utils/counter';
import { formatMoney } from '~/utils/masks';

/**
 * Staff builds an order for a chosen customer, made for the tablet on the counter: find products, set quantities
 * within the stock, pick the customer and confirm. Shared by the counter sale and the order placed on behalf of a
 * customer; the page decides where it goes. The Idempotency-Key keeps a retry from placing it twice.
 */
const props = defineProps<{
  wording: BuilderWording;
  submit: (draft: OrderDraft, idempotencyKey: string) => Promise<ApiResult<Order>>;
}>();
const emit = defineEmits<{ placed: [order: Order] }>();

const INSUFFICIENT_STOCK = 'insufficient-stock';
const INSUFFICIENT_STOCK_MESSAGE = 'Algum produto não tem a quantidade pedida. Confira o estoque e ajuste.';

const api = useApi();
const toast = useToast();

const query = ref('');
const lines = ref<CounterLine[]>([]);
const customer = ref<PickedCustomer | null>(null);
const notes = ref('');
const confirming = ref(false);
let idempotencyKey = crypto.randomUUID();

const total = computed(() => counterTotal(lines.value));
const units = computed(() => lines.value.reduce((sum, line) => sum + line.quantity, 0));
const missing = computed(() => {
  if (lines.value.length === 0) return 'Adicione pelo menos um produto.';
  return customer.value ? '' : `Escolha o cliente ${props.wording.of}.`;
});

function searchQuery(page: number) {
  const text = query.value.trim();
  const sort: 'relevance' | 'name' = text ? 'relevance' : 'name';
  return { q: text || undefined, available: 'true' as const, sort, page, pageSize: COUNTER_SEARCH_SIZE };
}

function fetchAvailableProducts(page: number) {
  return unwrap(api.GET('/api/v1/products', { params: { query: searchQuery(page) } }));
}

/** Only products with stock; the newest answer wins, so a slow search never replaces a newer one. */
const {
  rows: results,
  loading,
  failed,
  load: search,
  restart,
} = usePagedList(fetchAvailableProducts, COUNTER_SEARCH_SIZE);

let timer: ReturnType<typeof setTimeout> | undefined;
watch(query, () => {
  clearTimeout(timer);
  timer = setTimeout(restart, SEARCH_DEBOUNCE_MS);
});
onBeforeUnmount(() => clearTimeout(timer));
onMounted(search);

function quantityOf(product: ProductSummary): number {
  return lines.value.find((line) => line.product.id === product.id)?.quantity ?? 0;
}

function add(product: ProductSummary): void {
  lines.value = addToCounter(lines.value, product);
}

function remove(line: CounterLine): void {
  lines.value = lines.value.filter((item) => item !== line);
}

/** A refusal for lack of stock refreshes the search, so the screen shows the stock left. */
async function showRefusal(error: ApiError): Promise<void> {
  const isShortOfStock = error.code === INSUFFICIENT_STOCK;
  toast.error({ title: isShortOfStock ? INSUFFICIENT_STOCK_MESSAGE : error.message });
  if (isShortOfStock) await search();
}

async function send(): Promise<void> {
  const result = await props.submit(draftOf(customer.value!, lines.value, notes.value), idempotencyKey);
  // The API answered: the next attempt is a new order.
  idempotencyKey = crypto.randomUUID();
  if (result.data) emit('placed', result.data);
  else await showRefusal(problemToError(result.response.status, result.error));
}

async function confirm(): Promise<void> {
  // No answer keeps the same key, so trying again cannot place it twice.
  await holdWhile(confirming, true, false, () => runOrToast(send));
}
</script>

<template>
  <!-- minmax(0, 1fr): a long customer name must not widen the page past the phone screen (#139). -->
  <div
    class="grid grid-cols-1 items-start gap-5 md:grid-cols-[minmax(0,1fr)_19rem] lg:grid-cols-[minmax(0,1fr)_26rem]"
  >
    <section class="flex flex-col gap-4" aria-labelledby="builder-products">
      <h2 id="builder-products" class="text-lg font-bold text-text">Produtos</h2>
      <BaseTextField
        v-model="query"
        label="Buscar produto"
        type="search"
        inputmode="search"
        placeholder="Nome, marca ou modelo"
        autocomplete="off"
      >
        <template #prefix><Search class="size-5" aria-hidden="true" /></template>
      </BaseTextField>
      <p class="sr-only" role="status">
        {{ loading ? 'Buscando produtos…' : `${results.length} produtos` }}
      </p>
      <ErrorState v-if="failed" kind="server" :heading-level="3" @retry="search" />
      <div v-else-if="loading" class="grid gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
        <BaseSkeleton v-for="index in 4" :key="index" class="h-20 w-full rounded-lg" />
      </div>
      <p v-else-if="results.length === 0" class="rounded-lg bg-surface-sunken p-4 text-text-muted">
        Nenhum produto com estoque para “{{ query.trim() }}”. Confira a grafia ou busque pela marca.
      </p>
      <ul
        v-else
        class="grid gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2"
        aria-label="Produtos encontrados"
      >
        <li
          v-for="product in results"
          :key="product.id"
          class="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-sm"
        >
          <span class="size-14 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
            <CatalogProductImage :image="product.cover" alt="" sizes="56px" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="line-clamp-2 font-semibold break-words hyphens-auto text-text" lang="pt-BR">
              {{ product.name }}
            </p>
            <p class="text-sm text-text-muted tabular-nums">
              {{ formatMoney(product.priceCents) }} · {{ product.stockAvailable }} em estoque
            </p>
          </div>
          <BaseIconButton
            :label="`Adicionar ${product.name}`"
            variant="primary"
            :disabled="quantityOf(product) >= counterLimit(product)"
            @click="add(product)"
          >
            <Plus class="size-5" aria-hidden="true" />
          </BaseIconButton>
        </li>
      </ul>
    </section>

    <section
      class="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm md:sticky md:top-4"
      aria-labelledby="builder-order"
    >
      <h2 id="builder-order" class="text-lg font-bold text-text">{{ wording.heading }}</h2>
      <CounterCustomerPicker v-model="customer" />

      <p v-if="lines.length === 0" class="rounded-lg bg-surface-sunken p-4 text-sm text-text-muted">
        Nenhum produto ainda. Toque em + para adicionar.
      </p>
      <ul v-else class="divide-y divide-border" :aria-label="`Itens ${wording.of}`">
        <li v-for="line in lines" :key="line.product.id" class="flex flex-col gap-2 py-3">
          <div class="flex items-start justify-between gap-2">
            <p class="font-semibold text-text">{{ line.product.name }}</p>
            <BaseIconButton
              :label="`Tirar ${line.product.name} ${wording.of}`"
              size="sm"
              @click="remove(line)"
            >
              <Trash2 class="size-4.5" aria-hidden="true" />
            </BaseIconButton>
          </div>
          <div class="flex items-center justify-between gap-2">
            <CatalogQuantityStepper
              v-model="line.quantity"
              :max="counterLimit(line.product)"
              :label="`Quantidade de ${line.product.name}`"
              size="sm"
            />
            <p class="font-semibold text-text tabular-nums">
              {{ formatMoney(line.product.priceCents * line.quantity) }}
            </p>
          </div>
        </li>
      </ul>

      <BaseTextArea v-model="notes" label="Observação (opcional)" :rows="2" :maxlength="500" />

      <div class="flex items-baseline justify-between border-t border-border pt-3" aria-live="polite">
        <p class="text-text-muted">Total · {{ countLabel(units, 'item', 'itens') }}</p>
        <p class="text-2xl font-extrabold text-text tabular-nums" data-testid="counter-total">
          {{ formatMoney(total) }}
        </p>
      </div>
      <slot name="notice" />
      <p v-if="missing" class="text-sm text-text-muted">{{ missing }}</p>
      <BaseButton size="lg" block :disabled="Boolean(missing)" :loading="confirming" @click="confirm">
        {{ wording.confirm }}
      </BaseButton>
    </section>
  </div>
</template>
