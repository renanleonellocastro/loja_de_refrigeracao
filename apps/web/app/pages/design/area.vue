<script setup lang="ts">
import { GUEST, ROLE_LABELS, ROLES } from '@rc/contracts';
import { CalendarClock, Package, Receipt, Wrench } from 'lucide-vue-next';

/**
 * Preview of the signed in layout for each role, used by the style guide and the layout E2E tests.
 * The preview-actor middleware picks the role from ?papel=; leaving the page goes back to a guest.
 */
definePageMeta({ layout: 'area', title: 'Prévia da área', middleware: 'preview-actor' });
useHead({ title: 'Prévia da área | Refrigeração Castro', meta: [{ name: 'robots', content: 'noindex' }] });

const actor = useCurrentActor();
onBeforeUnmount(() => {
  actor.value = GUEST;
});

const STATS = [
  { label: 'Pedidos em análise', value: '8', icon: Package },
  { label: 'Serviços hoje', value: '5', icon: CalendarClock },
  { label: 'Orçamentos abertos', value: '3', icon: Receipt },
  { label: 'Aguardando aprovação', value: '2', icon: Wrench },
];

const COLUMNS: TableColumn[] = [
  { key: 'number', label: 'Pedido' },
  { key: 'customer', label: 'Cliente' },
  { key: 'status', label: 'Estado' },
  { key: 'total', label: 'Total', align: 'end' },
];

const ROWS = [
  { number: 'RC-000123', customer: 'Maria Aparecida', status: 'PENDING_REVIEW', total: formatMoney(189900) },
  { number: 'RC-000122', customer: 'João Batista', status: 'READY_FOR_PICKUP', total: formatMoney(45990) },
  { number: 'RC-000121', customer: 'Ana Lúcia', status: 'PICKED_UP', total: formatMoney(12500) },
];
</script>

<template>
  <div class="flex flex-col gap-8">
    <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Ver como">
      <span class="mr-1 text-sm font-semibold text-text-muted">Ver como:</span>
      <NuxtLink
        v-for="role in ROLES"
        :key="role"
        :to="{ query: { papel: role } }"
        class="inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors"
        :class="
          actor === role
            ? 'border-primary bg-primary text-on-primary'
            : 'border-border bg-surface text-text hover:border-primary'
        "
        :aria-current="actor === role ? 'true' : undefined"
      >
        {{ ROLE_LABELS[role] }}
      </NuxtLink>
    </div>

    <ul class="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <li
        v-for="stat in STATS"
        :key="stat.label"
        class="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-5"
      >
        <span class="flex size-10 items-center justify-center rounded-md bg-info-soft text-on-info-soft">
          <component :is="stat.icon" class="size-5" aria-hidden="true" />
        </span>
        <span class="font-display text-3xl font-extrabold text-text tabular-nums">{{ stat.value }}</span>
        <span class="text-sm text-text-muted">{{ stat.label }}</span>
      </li>
    </ul>

    <section aria-labelledby="ultimos-pedidos" class="flex flex-col gap-4">
      <h2 id="ultimos-pedidos" class="text-xl font-bold text-text">Últimos pedidos</h2>
      <BaseResponsiveTable :columns="COLUMNS" :rows="ROWS" row-key="number" caption="Últimos pedidos">
        <template #cell-status="{ value }">
          <BaseStatusBadge kind="order" :status="String(value)" size="sm" />
        </template>
      </BaseResponsiveTable>
    </section>
  </div>
</template>
