<script setup lang="ts">
import { formatLongDay, formatTimeRange, storeDay } from '~/utils/agenda';

/**
 * Management warning on the agenda: visits whose technician was removed and that still have to happen
 * (GET /appointments/awaiting-reassignment). Each links to the visit, where "Remarcar" picks another technician.
 * When the list cannot load the agenda still works, so the warning just stays hidden.
 */
const api = useApi();
const visits = ref<Appointment[]>([]);

const title = computed(() =>
  visits.value.length === 1
    ? '1 atendimento sem técnico'
    : `${visits.value.length} atendimentos sem técnico`,
);

async function load(): Promise<void> {
  visits.value = await unwrap(api.GET('/api/v1/appointments/awaiting-reassignment')).catch(() => []);
}

onMounted(load);
</script>

<template>
  <BaseAlert v-if="visits.length > 0" tone="warning" :title="title" data-testid="reassignments">
    <p>O técnico foi excluído. Abra cada atendimento e escolha outro técnico em Remarcar.</p>
    <ul class="mt-2 flex flex-col gap-1">
      <li v-for="visit in visits" :key="visit.id">
        <NuxtLink
          :to="`/agenda/${visit.id}`"
          class="inline-flex min-h-11 flex-wrap items-center gap-x-2 font-semibold underline"
        >
          <span class="first-letter:uppercase">
            {{ formatLongDay(storeDay(visit.startsAt)) }}, {{ formatTimeRange(visit.startsAt, visit.endsAt) }}
          </span>
          <span>· {{ visit.request.serviceType }}: {{ visit.request.customer.name }}</span>
        </NuxtLink>
      </li>
    </ul>
  </BaseAlert>
</template>
