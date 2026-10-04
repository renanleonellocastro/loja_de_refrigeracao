<script setup lang="ts">
import { ArrowLeft, Store, Wallet } from 'lucide-vue-next';
import { formatMoney } from '~/utils/masks';
import { STORE_INFO } from '~/utils/store';

/**
 * UC Comprar Produto, checkout (RF-22, D2): reviews the account cart and places the order, which reserves
 * the stock. The Idempotency-Key makes a retry after a dropped connection safe; a 409 lists the items
 * without stock so each one can be fixed right here.
 */
definePageMeta({ permission: 'orders.create' });
useSeoMeta({ title: 'Fechar pedido | Refrigeração Castro', robots: 'noindex, nofollow' });

type StockProblem = { productId: number; requested: number; available: number };

const api = useApi();
const cart = useCartStore();
const toast = useToast();

const notes = ref('');
const placing = ref(false);
/** Available quantity of each item refused by the last attempt. */
const shortages = ref<Record<number, number>>({});
let idempotencyKey = crypto.randomUUID();

onMounted(() => void cart.load());

function shortageOf(line: CartLine): number | undefined {
  const reported = shortages.value[line.product.id];
  if (reported !== undefined) return reported;
  return line.problem ? line.product.stockAvailable : undefined;
}

function shortageText(available: number): string {
  return available === 0
    ? 'Este produto esgotou enquanto você comprava.'
    : `Temos só ${countLabel(available, 'unidade disponível', 'unidades disponíveis')}.`;
}

async function fix(line: CartLine, available: number): Promise<void> {
  const done =
    available === 0 ? await cart.remove(line.product.id) : await cart.setQuantity(line.product, available);
  // A refused change keeps the warning, so the person sees what is still wrong.
  if (!done) return;
  const next = { ...shortages.value };
  delete next[line.product.id];
  shortages.value = next;
}

const blocked = computed(() => cart.items.some((line) => shortageOf(line) !== undefined));

async function place(): Promise<void> {
  placing.value = true;
  shortages.value = {};
  try {
    const result = await api.POST('/api/v1/orders', {
      body: notes.value.trim() ? { notes: notes.value.trim() } : {},
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    if (result.data) {
      cart.clearAfterOrder();
      await navigateTo(`/carrinho/pedido/${result.data.id}`);
      return;
    }
    // The API answered: this attempt is over, the next one is a new order request.
    idempotencyKey = crypto.randomUUID();
    const error = problemToError(result.response.status, result.error);
    if (error.code === 'insufficient-stock') {
      const items = (result.error as { items?: StockProblem[] }).items ?? [];
      shortages.value = Object.fromEntries(items.map((item) => [item.productId, item.available]));
      toast.error({ title: 'Alguns itens não têm a quantidade pedida. Ajuste e tente de novo.' });
      await cart.load();
    } else toast.error({ title: error.message });
  } catch (error) {
    // No answer: keep the same key, so trying again cannot create a second order.
    toast.error({ title: toApiError(error).message });
  } finally {
    placing.value = false;
  }
}
</script>

<template>
  <div class="rc-container max-w-5xl py-6 sm:py-10">
    <NuxtLink to="/carrinho" class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link">
      <ArrowLeft class="size-4" aria-hidden="true" />
      Voltar ao carrinho
    </NuxtLink>
    <h1 class="mt-2 text-3xl font-extrabold text-text sm:text-4xl">Fechar pedido</h1>

    <div v-if="!cart.loaded" class="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]" role="status">
      <span class="sr-only">Carregando o pedido…</span>
      <BaseSkeleton class="h-72 w-full rounded-xl" />
      <BaseSkeleton class="h-56 w-full rounded-xl" />
    </div>

    <BaseEmptyState
      v-else-if="cart.items.length === 0"
      title="Seu carrinho está vazio"
      text="Escolha os produtos primeiro e depois volte aqui para fechar o pedido."
    >
      <template #illustration>
        <img src="/illustrations/vazio-carrinho.svg" alt="" width="240" height="180" class="h-36 w-auto" />
      </template>
      <template #action><BaseButton to="/produtos">Ver produtos</BaseButton></template>
    </BaseEmptyState>

    <form v-else class="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_22rem]" @submit.prevent="place">
      <div class="flex flex-col gap-6">
        <BaseCard title="Revise os itens" :heading-level="2">
          <ul class="divide-y divide-border">
            <li
              v-for="line in cart.items"
              :key="line.product.id"
              class="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
              :data-product="line.product.slug"
            >
              <div class="flex items-center gap-3">
                <div class="size-14 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
                  <CatalogProductImage :image="line.product.cover" alt="" sizes="56px" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="line-clamp-2 font-semibold text-text">{{ line.product.name }}</p>
                  <p class="text-sm text-text-muted tabular-nums">
                    {{ line.quantity }} × {{ formatMoney(line.product.priceCents) }}
                  </p>
                </div>
                <p class="font-bold text-text tabular-nums">{{ formatMoney(line.subtotalCents) }}</p>
              </div>
              <div
                v-if="shortageOf(line) !== undefined"
                class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-danger-soft px-3 py-2 text-sm text-on-danger-soft"
                role="alert"
              >
                <span class="flex-1">{{ shortageText(shortageOf(line)!) }}</span>
                <button
                  type="button"
                  class="font-semibold underline underline-offset-2"
                  :disabled="cart.busy"
                  @click="fix(line, shortageOf(line)!)"
                >
                  {{ shortageOf(line) === 0 ? 'Tirar do pedido' : `Ajustar para ${shortageOf(line)}` }}
                </button>
              </div>
            </li>
          </ul>
        </BaseCard>

        <BaseCard title="Observações" :heading-level="2">
          <BaseTextArea
            v-model="notes"
            label="Recado para a loja (opcional)"
            hint="Por exemplo: quem vai retirar ou o melhor horário."
            :maxlength="500"
            :rows="3"
          />
        </BaseCard>
      </div>

      <aside
        class="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm lg:sticky lg:top-24"
        aria-labelledby="total-titulo"
      >
        <h2 id="total-titulo" class="text-lg font-bold text-text">Total</h2>
        <p class="text-3xl font-extrabold text-text tabular-nums">{{ formatMoney(cart.totalCents) }}</p>
        <div class="flex items-start gap-3 rounded-lg bg-info-soft p-3 text-sm text-on-info-soft">
          <Wallet class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>
            <strong>Pagamento na retirada.</strong> Nada é cobrado agora: você paga na loja quando buscar os
            produtos.
          </p>
        </div>
        <p class="flex items-start gap-2 text-sm text-text-muted">
          <Store class="mt-0.5 size-4 shrink-0 text-link" aria-hidden="true" />
          Retirada na {{ STORE_INFO.street }}, {{ STORE_INFO.city }}. {{ STORE_INFO.hours }}.
        </p>
        <BaseButton type="submit" size="lg" block :loading="placing" :disabled="blocked || cart.busy">
          Confirmar pedido
        </BaseButton>
        <p class="text-xs text-text-muted">
          Os itens ficam reservados para você enquanto a loja confere o pedido.
        </p>
      </aside>
    </form>
  </div>
</template>
