<script setup lang="ts">
import { formatDate, formatDateTime } from '~/utils/masks';

/** Last visit requests of the customer on the profile, with a link to "Meus agendamentos". */
const api = useApi();
const { rows, loading, failed } = useRecentList((pageSize) =>
  unwrap(api.GET('/api/v1/service-requests', { params: { query: { pageSize } } })),
);

function details(request: ServiceRequestListItem): string {
  const when = request.scheduledFor
    ? `Visita em ${formatDateTime(request.scheduledFor)}`
    : `Pedido em ${formatDate(request.createdAt)}`;
  return `${request.productKind} · ${when}`;
}
</script>

<template>
  <ProfileRecentCard
    title="Últimos serviços"
    all-to="/minha-conta/agendamentos"
    empty-text="Nenhum serviço agendado ainda."
    start-to="/agendar"
    start-label="Agendar visita"
    :loading="loading"
    :failed="failed"
    :empty="rows.length === 0"
  >
    <ProfileRecentRow
      v-for="request in rows"
      :key="request.id"
      :to="`/minha-conta/agendamentos/${request.id}`"
      :title="request.serviceType"
      :details="details(request)"
    >
      <template #status>
        <BaseStatusBadge kind="serviceRequest" :status="request.status" size="sm" />
      </template>
    </ProfileRecentRow>
  </ProfileRecentCard>
</template>
