<script setup lang="ts">
import { can } from '@rc/contracts';
import { formatTimeRange } from '~/utils/agenda';
import { formatDate, formatMoney } from '~/utils/masks';

/**
 * Recent history on a user detail: the last orders and service requests of a customer, or the last visits of
 * a technician, each linking to its own screen. A list only shows when the viewer may open its records.
 */
const props = defineProps<{ kind: DirectoryKind; activity: UserActivity }>();

const auth = useAuthStore();
const showOrders = computed(() => props.kind === 'CLIENT' && can(auth.actor, 'orders.manage'));
const showRequests = computed(() => props.kind === 'CLIENT' && can(auth.actor, 'serviceRequests.manage'));
const showAppointments = computed(() => props.kind === 'EMPLOYEE');
</script>

<template>
  <BaseCard v-if="showOrders" title="Últimos pedidos">
    <p v-if="activity.recentOrders.length === 0" class="text-sm text-text-muted">Nenhum pedido ainda.</p>
    <ul v-else class="divide-y divide-border">
      <li v-for="order in activity.recentOrders" :key="order.id">
        <NuxtLink
          :to="`/pedidos/${order.id}`"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:text-link"
        >
          <span class="font-semibold tabular-nums">Pedido {{ order.number }}</span>
          <BaseStatusBadge kind="order" :status="order.status" size="sm" />
          <span class="ml-auto text-sm text-text-muted tabular-nums">
            {{ formatDate(order.createdAt) }} · {{ formatMoney(order.totalCents) }}
          </span>
        </NuxtLink>
      </li>
    </ul>
  </BaseCard>

  <BaseCard v-if="showRequests" title="Últimas solicitações de serviço">
    <p v-if="activity.recentServiceRequests.length === 0" class="text-sm text-text-muted">
      Nenhuma solicitação ainda.
    </p>
    <ul v-else class="divide-y divide-border">
      <li v-for="request in activity.recentServiceRequests" :key="request.id">
        <NuxtLink
          :to="`/solicitacoes/${request.id}`"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:text-link"
        >
          <span class="font-semibold">{{ request.serviceType }} · {{ request.productKind }}</span>
          <BaseStatusBadge kind="serviceRequest" :status="request.status" size="sm" />
          <span class="ml-auto text-sm text-text-muted tabular-nums">{{
            formatDate(request.createdAt)
          }}</span>
        </NuxtLink>
      </li>
    </ul>
  </BaseCard>

  <BaseCard v-if="showAppointments" title="Últimos atendimentos">
    <p v-if="activity.recentAppointments.length === 0" class="text-sm text-text-muted">
      Nenhum atendimento ainda.
    </p>
    <ul v-else class="divide-y divide-border">
      <li v-for="visit in activity.recentAppointments" :key="visit.id">
        <NuxtLink
          :to="`/agenda/${visit.id}`"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:text-link"
        >
          <span class="font-semibold">{{ visit.customerName }} · {{ visit.serviceType }}</span>
          <BaseStatusBadge kind="serviceRequest" :status="visit.status" size="sm" />
          <span class="ml-auto text-sm text-text-muted tabular-nums">
            {{ formatDate(visit.startsAt) }} · {{ formatTimeRange(visit.startsAt, visit.endsAt) }}
          </span>
        </NuxtLink>
      </li>
    </ul>
  </BaseCard>
</template>
