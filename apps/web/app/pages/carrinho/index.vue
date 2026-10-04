<script setup lang="ts">
import { ArrowRight, Store, Trash2 } from 'lucide-vue-next';
import { formatMoney } from '~/utils/masks';

/** UC Comprar Produto, cart step (RF-21): open to visitors; closing the order asks to sign in. */
useSeoMeta({ title: 'Carrinho | Refrigeração Castro', robots: 'noindex, nofollow' });

const cart = useCartStore();

onMounted(() => void cart.load());

function problemText(line: CartLine): string {
  if (line.problem === 'unavailable') return 'Este produto esgotou. Tire do carrinho para continuar.';
  return `Temos só ${countLabel(line.product.stockAvailable, 'unidade disponível', 'unidades disponíveis')}.`;
}

async function fix(line: CartLine): Promise<void> {
  if (line.problem === 'unavailable') await cart.remove(line.product.id);
  else await cart.setQuantity(line.product, line.product.stockAvailable);
}
</script>

<template>
  <div class="rc-container py-6 sm:py-10">
    <h1 class="text-3xl font-extrabold text-text sm:text-4xl">Carrinho</h1>

    <div v-if="!cart.loaded" class="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]" role="status">
      <span class="sr-only">Carregando o carrinho…</span>
      <div class="flex flex-col gap-3">
        <BaseSkeleton v-for="n in 3" :key="n" class="h-28 w-full rounded-xl" />
      </div>
      <BaseSkeleton class="h-56 w-full rounded-xl" />
    </div>

    <BaseEmptyState
      v-else-if="cart.items.length === 0"
      title="Seu carrinho está vazio"
      text="Dê uma olhada nos produtos: geladeiras, freezers, ar condicionado e peças, novos e revisados."
    >
      <template #illustration>
        <img src="/illustrations/vazio-carrinho.svg" alt="" width="240" height="180" class="h-36 w-auto" />
      </template>
      <template #action><BaseButton to="/produtos">Ver produtos</BaseButton></template>
    </BaseEmptyState>

    <div v-else class="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
      <ul class="flex flex-col gap-3" aria-label="Itens do carrinho">
        <li
          v-for="line in cart.items"
          :key="line.product.id"
          class="flex gap-3 rounded-xl border bg-surface p-3 sm:gap-4 sm:p-4"
          :class="line.problem ? 'border-danger' : 'border-border'"
          :data-product="line.product.slug"
        >
          <NuxtLink
            :to="`/produtos/${line.product.slug}`"
            class="size-20 shrink-0 overflow-hidden rounded-lg bg-surface-sunken sm:size-24"
            tabindex="-1"
            aria-hidden="true"
          >
            <CatalogProductImage :image="line.product.cover" alt="" sizes="96px" />
          </NuxtLink>
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <div class="flex items-start justify-between gap-2">
              <NuxtLink
                :to="`/produtos/${line.product.slug}`"
                class="line-clamp-2 font-semibold text-text hover:text-link"
              >
                {{ line.product.name }}
              </NuxtLink>
              <BaseIconButton
                :label="`Remover ${line.product.name}`"
                size="sm"
                :disabled="cart.busy"
                @click="cart.remove(line.product.id)"
              >
                <Trash2 />
              </BaseIconButton>
            </div>
            <p class="text-sm text-text-muted tabular-nums">
              {{ formatMoney(line.product.priceCents) }} cada
            </p>
            <div class="mt-auto flex flex-wrap items-center justify-between gap-2">
              <CatalogQuantityStepper
                :model-value="line.quantity"
                :max="Math.max(line.product.stockAvailable, line.quantity)"
                :label="`Quantidade de ${line.product.name}`"
                :disabled="cart.busy || line.problem === 'unavailable'"
                size="sm"
                @update:model-value="cart.setQuantity(line.product, $event)"
              />
              <p class="font-bold text-text tabular-nums">{{ formatMoney(line.subtotalCents) }}</p>
            </div>
            <div
              v-if="line.problem"
              class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-danger-soft px-3 py-2 text-sm text-on-danger-soft"
              role="alert"
            >
              <span class="flex-1">{{ problemText(line) }}</span>
              <button type="button" class="font-semibold underline underline-offset-2" @click="fix(line)">
                {{
                  line.problem === 'unavailable'
                    ? 'Tirar do carrinho'
                    : `Ajustar para ${line.product.stockAvailable}`
                }}
              </button>
            </div>
          </div>
        </li>
      </ul>

      <aside
        class="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm lg:sticky lg:top-24"
        aria-labelledby="resumo-titulo"
      >
        <h2 id="resumo-titulo" class="text-lg font-bold text-text">Resumo</h2>
        <dl class="flex flex-col gap-2 text-sm">
          <div class="flex justify-between text-text-muted">
            <dt>Itens</dt>
            <dd class="tabular-nums">{{ cart.count }}</dd>
          </div>
          <div class="flex items-baseline justify-between border-t border-border pt-3 text-text">
            <dt class="font-semibold">Total</dt>
            <dd class="text-2xl font-extrabold tabular-nums">{{ formatMoney(cart.totalCents) }}</dd>
          </div>
        </dl>
        <p class="flex items-start gap-2 text-sm text-text-muted">
          <Store class="mt-0.5 size-4 shrink-0 text-link" aria-hidden="true" />
          Você reserva agora e paga na loja, na hora de retirar.
        </p>
        <BaseButton to="/carrinho/finalizar" size="lg" block :disabled="!cart.ready || cart.busy">
          Fechar pedido
          <ArrowRight class="size-5" aria-hidden="true" />
        </BaseButton>
        <p v-if="!cart.ready" class="text-sm text-danger">Resolva os itens marcados para continuar.</p>
        <NuxtLink to="/produtos" class="text-center text-sm font-semibold text-link hover:underline">
          Continuar comprando
        </NuxtLink>
      </aside>
    </div>
  </div>
</template>
