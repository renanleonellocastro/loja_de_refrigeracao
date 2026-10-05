<script setup lang="ts">
import type { ApiSchemas } from '@rc/contracts';
import {
  BadgeCheck,
  CalendarDays,
  Inbox,
  MessageCircle,
  Package,
  PackageCheck,
  ReceiptText,
  TriangleAlert,
  Wallet,
} from 'lucide-vue-next';
import { formatLongDay, formatTimeRange, storeDay } from '~/utils/agenda';
import { formatMoney } from '~/utils/masks';

/** UC Painel da Equipe (RF-38): the store at a glance for the management; technicians go to their day. */
definePageMeta({ layout: 'area', permission: 'dashboard.read', title: 'Painel' });

type Management = NonNullable<ApiSchemas['Dashboard']['management']>;

/** The indicators refresh on their own while the page stays open (issue #78). */
const REFRESH_MS = 60_000;

const api = useApi();
const auth = useAuthStore();

const management = ref<Management | null>(null);
const loading = ref(true);
const failed = ref(false);
let timer: ReturnType<typeof setInterval> | undefined;

async function load(): Promise<void> {
  failed.value = false;
  try {
    management.value = (await unwrap(api.GET('/api/v1/dashboard'))).management;
  } catch {
    // A failed refresh keeps the last numbers on screen.
    failed.value = management.value === null;
  } finally {
    loading.value = false;
  }
}

const tiles = computed(() => {
  const m = management.value!;
  return [
    {
      label: 'Pedidos em análise',
      value: m.ordersByStatus.PENDING_REVIEW,
      to: '/pedidos?estado=PENDING_REVIEW',
      icon: Package,
    },
    {
      label: 'Prontos para retirada',
      value: m.ordersByStatus.READY_FOR_PICKUP,
      to: '/pedidos?estado=READY_FOR_PICKUP',
      icon: PackageCheck,
    },
    {
      label: 'Solicitações novas',
      value: m.openServiceRequests.REQUESTED,
      to: '/solicitacoes?estado=REQUESTED',
      icon: Inbox,
    },
    {
      label: 'Aguardando o cliente',
      value: m.openServiceRequests.AWAITING_CUSTOMER,
      to: '/solicitacoes?estado=AWAITING_CUSTOMER',
      icon: MessageCircle,
    },
    {
      label: 'Orçamentos a responder',
      value: m.quotesAwaitingAnswer,
      to: '/orcamentos?estado=REQUESTED',
      icon: ReceiptText,
    },
    {
      label: 'Finalizações a aprovar',
      value: m.reportsAwaitingApproval,
      to: '/aprovacoes',
      icon: BadgeCheck,
    },
  ];
});

const visitsToday = computed(() =>
  management.value!.agendaToday.reduce((sum, group) => sum + group.appointments.length, 0),
);

onMounted(() => {
  if (auth.actor === 'EMPLOYEE') {
    void navigateTo('/hoje', { replace: true });
    return;
  }
  void load();
  timer = setInterval(() => void load(), REFRESH_MS);
});

onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <div class="flex flex-col gap-8">
    <p class="text-text-muted first-letter:uppercase">{{ formatLongDay(storeDay()) }}</p>

    <p class="sr-only" role="status">{{ loading ? 'Carregando o painel…' : '' }}</p>
    <ErrorState v-if="failed" kind="server" :heading-level="2" @retry="load" />
    <div v-else-if="loading" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <BaseSkeleton v-for="n in 6" :key="n" class="h-28 w-full rounded-xl" />
    </div>

    <template v-else-if="management">
      <section aria-labelledby="indicadores-titulo">
        <h2 id="indicadores-titulo" class="sr-only">Indicadores</h2>
        <ul class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <li v-for="tile in tiles" :key="tile.label">
            <NuxtLink
              :to="tile.to"
              class="flex h-full items-center gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm transition-[box-shadow,border-color] hover:border-primary/40 hover:shadow-md"
              data-testid="kpi"
            >
              <span
                class="flex size-12 shrink-0 items-center justify-center rounded-lg"
                :class="
                  tile.value > 0 ? 'bg-warning-soft text-on-warning-soft' : 'bg-info-soft text-on-info-soft'
                "
              >
                <component :is="tile.icon" class="size-6" aria-hidden="true" />
              </span>
              <span class="flex flex-col">
                <span class="text-3xl font-extrabold text-text tabular-nums">{{ tile.value }}</span>
                <span class="text-text-muted">{{ tile.label }}</span>
              </span>
            </NuxtLink>
          </li>
          <li>
            <div
              class="flex h-full items-center gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm"
              data-testid="revenue"
            >
              <span
                class="flex size-12 shrink-0 items-center justify-center rounded-lg bg-success-soft text-on-success-soft"
              >
                <Wallet class="size-6" aria-hidden="true" />
              </span>
              <span class="flex flex-col">
                <span class="text-2xl font-extrabold text-text tabular-nums">
                  {{ formatMoney(management.serviceRevenueMonthCents) }}
                </span>
                <span class="text-text-muted">Serviços aprovados no mês</span>
              </span>
            </div>
          </li>
        </ul>
      </section>

      <div class="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <BaseCard
          title="Agenda de hoje"
          :description="`${visitsToday} ${visitsToday === 1 ? 'visita' : 'visitas'}`"
        >
          <template #actions>
            <BaseButton to="/agenda" variant="ghost" size="sm">
              <CalendarDays class="size-4" aria-hidden="true" />
              Ver agenda
            </BaseButton>
          </template>
          <p v-if="management.agendaToday.length === 0" class="text-text-muted">
            Nenhuma visita marcada para hoje.
          </p>
          <div v-else class="flex flex-col gap-5">
            <section
              v-for="group in management.agendaToday"
              :key="group.employee.id"
              :aria-label="group.employee.name"
              data-testid="agenda-group"
            >
              <h3 class="font-bold text-text">{{ group.employee.name }}</h3>
              <ul class="mt-2 flex flex-col divide-y divide-border">
                <li v-for="visit in group.appointments" :key="visit.id">
                  <NuxtLink
                    :to="`/agenda/${visit.id}`"
                    class="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 hover:underline"
                  >
                    <span class="font-semibold text-text tabular-nums">
                      {{ formatTimeRange(visit.startsAt, visit.endsAt) }}
                    </span>
                    <span class="min-w-0 flex-1 text-text-muted">
                      {{ visit.request.serviceType }}: {{ visit.request.customer.name }}
                    </span>
                    <BaseStatusBadge kind="serviceRequest" :status="visit.request.status" />
                  </NuxtLink>
                </li>
              </ul>
            </section>
          </div>
        </BaseCard>

        <BaseCard title="Estoque baixo" :description="`${management.lowStock.total} abaixo do mínimo`">
          <p v-if="management.lowStock.total === 0" class="text-text-muted">
            Tudo certo: nenhum produto abaixo do mínimo.
          </p>
          <ul v-else class="flex flex-col divide-y divide-border" data-testid="low-stock">
            <li v-for="product in management.lowStock.items" :key="product.id">
              <NuxtLink
                :to="`/produtos/gerenciar/${product.id}`"
                class="flex min-h-11 items-center justify-between gap-3 py-2 hover:underline"
              >
                <span class="min-w-0 text-text">{{ product.name }}</span>
                <span
                  class="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-on-warning-soft tabular-nums"
                >
                  <TriangleAlert class="size-4" aria-hidden="true" />
                  {{ product.stockAvailable }} de {{ product.stockMin }}
                </span>
              </NuxtLink>
            </li>
          </ul>
          <p
            v-if="management.lowStock.total > management.lowStock.items.length"
            class="mt-3 text-sm text-text-muted"
          >
            E mais {{ management.lowStock.total - management.lowStock.items.length }} produtos.
            <NuxtLink to="/produtos/gerenciar" class="font-semibold text-link">Ver produtos</NuxtLink>
          </p>
        </BaseCard>
      </div>
    </template>
  </div>
</template>
