<script setup lang="ts">
import { CalendarPlus, ChevronRight } from 'lucide-vue-next';
import { formatDate, formatDateTime } from '~/utils/masks';
import { REQUESTS_PAGE_SIZE } from '~/utils/service-requests';

/** UC Consultar Meus Agendamentos: the visit requests of the signed in customer, newest first. */
definePageMeta({ layout: 'area', permission: 'serviceRequests.cancel', title: 'Meus agendamentos' });
useHead({ title: 'Meus agendamentos | Refrigeração Castro' });

const api = useApi();

const { page, rows, pages, loading, failed, load } = usePagedList(
  (current) =>
    unwrap(
      api.GET('/api/v1/service-requests', {
        params: { query: { page: current, pageSize: REQUESTS_PAGE_SIZE } },
      }),
    ),
  REQUESTS_PAGE_SIZE,
);

onMounted(load);
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-5">
    <div class="flex justify-end">
      <BaseButton to="/agendar">
        <CalendarPlus class="size-5" aria-hidden="true" />
        Agendar visita
      </BaseButton>
    </div>

    <ErrorState v-if="failed" kind="server" :heading-level="2" @retry="load" />

    <div v-else-if="loading" class="flex flex-col gap-3" role="status">
      <span class="sr-only">Carregando agendamentos…</span>
      <BaseSkeleton v-for="n in 3" :key="n" class="h-24 w-full rounded-xl" />
    </div>

    <BaseEmptyState
      v-else-if="rows.length === 0"
      title="Nenhum agendamento"
      text="Quando você pedir uma visita, ela aparece aqui."
    >
      <template #illustration>
        <img src="/illustrations/vazio-agenda.svg" alt="" width="240" height="180" class="h-36 w-auto" />
      </template>
      <template #action><BaseButton to="/servicos">Ver serviços</BaseButton></template>
    </BaseEmptyState>

    <template v-else>
      <ul class="flex flex-col gap-3" aria-label="Agendamentos">
        <li v-for="request in rows" :key="request.id">
          <NuxtLink
            :to="`/minha-conta/agendamentos/${request.id}`"
            class="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary hover:bg-surface-sunken"
          >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span class="font-bold text-text">{{ request.serviceType }}</span>
                <BaseStatusBadge kind="serviceRequest" :status="request.status" size="sm" />
              </div>
              <p class="mt-1 text-sm text-text-muted">
                {{ request.productKind }} · Solicitação {{ request.id }} · {{ formatDate(request.createdAt) }}
              </p>
              <p v-if="request.scheduledFor" class="mt-1 text-sm font-semibold text-text">
                Visita em {{ formatDateTime(request.scheduledFor)
                }}{{ request.employee ? ` com ${request.employee.name}` : '' }}
              </p>
            </div>
            <ChevronRight class="size-5 shrink-0 text-text-muted" aria-hidden="true" />
          </NuxtLink>
        </li>
      </ul>
      <BasePagination v-model:page="page" :total="pages" label="Páginas de agendamentos" />
    </template>
  </div>
</template>
