<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next';
import { formatDate, formatMoney } from '~/utils/masks';
import { countLabel } from '~/utils/catalog';

/** UC Consultar Pedidos (RF-23): the orders of the signed in customer, newest first. */
definePageMeta({ layout: 'area', permission: 'orders.read', title: 'Meus pedidos' });
useHead({ title: 'Meus pedidos | Refrigeração Castro' });

const PAGE_SIZE = 10;

const api = useApi();
const items = ref<OrderListItem[]>([]);
const loaded = ref(false);
const failed = ref(false);
const page = ref(1);
const pages = ref(0);

async function load(): Promise<void> {
  failed.value = false;
  try {
    const result = await unwrap(
      api.GET('/api/v1/orders', { params: { query: { page: page.value, pageSize: PAGE_SIZE } } }),
    );
    items.value = result.data;
    pages.value = Math.ceil(result.meta.total / PAGE_SIZE);
    loaded.value = true;
  } catch {
    failed.value = true;
  }
}

watch(page, load);
onMounted(load);
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-5">
    <ErrorState v-if="failed" kind="server" :heading-level="2" @retry="load" />

    <div v-else-if="!loaded" class="flex flex-col gap-3" role="status">
      <span class="sr-only">Carregando pedidos…</span>
      <BaseSkeleton v-for="n in 3" :key="n" class="h-24 w-full rounded-xl" />
    </div>

    <BaseEmptyState
      v-else-if="items.length === 0"
      title="Nenhum pedido por aqui ainda"
      text="Que tal dar uma olhada nos produtos? Você reserva pelo site e paga na retirada."
    >
      <template #illustration>
        <img src="/illustrations/vazio-pedidos.svg" alt="" width="240" height="180" class="h-36 w-auto" />
      </template>
      <template #action><BaseButton to="/produtos">Ver produtos</BaseButton></template>
    </BaseEmptyState>

    <template v-else>
      <ul class="flex flex-col gap-3" aria-label="Pedidos">
        <li v-for="order in items" :key="order.id">
          <NuxtLink
            :to="`/minha-conta/pedidos/${order.id}`"
            class="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary hover:bg-surface-sunken"
          >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span class="font-bold text-text tabular-nums">Pedido {{ order.number }}</span>
                <BaseStatusBadge kind="order" :status="order.status" size="sm" />
              </div>
              <p class="mt-1 text-sm text-text-muted">
                {{ formatDate(order.createdAt) }} · {{ countLabel(order.itemCount, 'item', 'itens') }} ·
                <span class="font-semibold text-text tabular-nums">{{ formatMoney(order.totalCents) }}</span>
              </p>
            </div>
            <ChevronRight class="size-5 shrink-0 text-text-muted" aria-hidden="true" />
          </NuxtLink>
        </li>
      </ul>
      <BasePagination v-model:page="page" :total="pages" label="Páginas de pedidos" />
    </template>
  </div>
</template>
