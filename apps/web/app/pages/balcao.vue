<script setup lang="ts">
import { can } from '@rc/contracts';
import { CircleCheck, Plus, Search, Trash2 } from 'lucide-vue-next';
import { countLabel } from '~/utils/catalog';
import { addToCounter, counterLimit, counterTotal, COUNTER_SEARCH_SIZE } from '~/utils/counter';
import { formatMoney } from '~/utils/masks';

/**
 * UC Venda no Balcão (RF-26), made for the tablet on the counter: find products, set quantities within the
 * stock, pick the customer and confirm. The Idempotency-Key keeps a retry from selling twice.
 */
definePageMeta({ layout: 'area', permission: 'counterSales.create', title: 'Venda no balcão' });
useHead({ title: 'Venda no balcão | Refrigeração Castro' });

const api = useApi();
const auth = useAuthStore();
const toast = useToast();
const canOpenOrders = computed(() => can(auth.actor, 'orders.manage'));

const query = ref('');
const lines = ref<CounterLine[]>([]);
const customer = ref<PickedCustomer | null>(null);
const notes = ref('');
const confirming = ref(false);
const sale = ref<Order | null>(null);
let idempotencyKey = crypto.randomUUID();

const total = computed(() => counterTotal(lines.value));
const units = computed(() => lines.value.reduce((sum, line) => sum + line.quantity, 0));
const missing = computed(() => {
  if (lines.value.length === 0) return 'Adicione pelo menos um produto.';
  return customer.value ? '' : 'Escolha o cliente da venda.';
});

/** Only products with stock; the newest answer wins, so a slow search never replaces a newer one. */
const {
  rows: results,
  loading,
  failed,
  load: search,
  restart,
} = usePagedList((page) => {
  const q = query.value.trim();
  return unwrap(
    api.GET('/api/v1/products', {
      params: {
        query: {
          q: q || undefined,
          available: 'true',
          sort: q ? 'relevance' : 'name',
          page,
          pageSize: COUNTER_SEARCH_SIZE,
        },
      },
    }),
  );
}, COUNTER_SEARCH_SIZE);

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

async function confirm(): Promise<void> {
  confirming.value = true;
  try {
    const result = await api.POST('/api/v1/counter-sales', {
      body: {
        customerId: customer.value!.id,
        items: lines.value.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        notes: notes.value.trim() || undefined,
      },
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    // The API answered: the next attempt is a new sale.
    idempotencyKey = crypto.randomUUID();
    if (result.data) {
      sale.value = result.data;
      return;
    }
    const error = problemToError(result.response.status, result.error);
    toast.error({
      title:
        error.code === 'insufficient-stock'
          ? 'Algum produto não tem a quantidade pedida. Confira o estoque e ajuste.'
          : error.message,
    });
    if (error.code === 'insufficient-stock') await search();
  } catch (error) {
    // No answer: keep the same key, so trying again cannot sell twice.
    toast.error({ title: toApiError(error).message });
  } finally {
    confirming.value = false;
  }
}

function startOver(): void {
  sale.value = null;
  lines.value = [];
  customer.value = null;
  notes.value = '';
  if (query.value) query.value = '';
  else void search();
}
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <div v-if="sale" class="mx-auto flex max-w-xl flex-col gap-5" data-testid="counter-success">
      <div class="flex flex-col items-center gap-3 text-center">
        <span
          class="flex size-16 items-center justify-center rounded-full bg-success-soft text-on-success-soft"
        >
          <CircleCheck class="size-9" aria-hidden="true" />
        </span>
        <h2 class="text-2xl font-extrabold text-text">Venda registrada!</h2>
        <p class="text-text-muted">
          Pedido
          <strong class="text-text tabular-nums" data-testid="sale-number">{{ sale.number }}</strong> para
          {{ sale.customer.name }}. O estoque já foi atualizado.
        </p>
      </div>
      <BaseCard title="Resumo" :heading-level="3">
        <OrderItems :order="sale" />
      </BaseCard>
      <div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <BaseButton v-if="canOpenOrders" variant="secondary" :to="`/pedidos/${sale.id}`"
          >Ver pedido</BaseButton
        >
        <BaseButton @click="startOver">Nova venda</BaseButton>
      </div>
    </div>

    <div v-else class="grid items-start gap-5 md:grid-cols-[1fr_19rem] lg:grid-cols-[1fr_26rem]">
      <section class="flex flex-col gap-4" aria-labelledby="counter-products">
        <h2 id="counter-products" class="text-lg font-bold text-text">Produtos</h2>
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
        aria-labelledby="counter-sale"
      >
        <h2 id="counter-sale" class="text-lg font-bold text-text">Venda</h2>
        <CounterCustomerPicker v-model="customer" />

        <p v-if="lines.length === 0" class="rounded-lg bg-surface-sunken p-4 text-sm text-text-muted">
          Nenhum produto ainda. Toque em + para adicionar.
        </p>
        <ul v-else class="divide-y divide-border" aria-label="Itens da venda">
          <li v-for="line in lines" :key="line.product.id" class="flex flex-col gap-2 py-3">
            <div class="flex items-start justify-between gap-2">
              <p class="font-semibold text-text">{{ line.product.name }}</p>
              <BaseIconButton :label="`Tirar ${line.product.name} da venda`" size="sm" @click="remove(line)">
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
        <p v-if="missing" class="text-sm text-text-muted">{{ missing }}</p>
        <BaseButton size="lg" block :disabled="Boolean(missing)" :loading="confirming" @click="confirm">
          Confirmar venda
        </BaseButton>
      </section>
    </div>
  </div>
</template>
