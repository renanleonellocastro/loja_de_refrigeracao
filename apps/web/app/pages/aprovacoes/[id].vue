<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next';
import { REPORT_STATUS_LABELS } from '~/utils/agenda';

/** One report waiting for approval, opened from the notification sent when the technician finalizes. */
definePageMeta({ layout: 'area', permission: 'appointments.approve', title: 'Aprovação' });

const api = useApi();
const route = useRoute();

const appointment = ref<Appointment | null>(null);
const failed = ref(false);
const notFound = ref(false);

async function load(): Promise<void> {
  failed.value = false;
  try {
    appointment.value = await unwrap(
      api.GET('/api/v1/appointments/{id}', { params: { path: { id: Number(route.params.id) } } }),
    );
  } catch (error) {
    notFound.value = toApiError(error).status === 404;
    failed.value = true;
  }
}

function decided(next: Appointment): void {
  appointment.value = next;
}

onMounted(load);
</script>

<template>
  <div class="mx-auto flex max-w-4xl flex-col gap-5">
    <NuxtLink
      to="/aprovacoes"
      class="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-link"
    >
      <ArrowLeft class="size-4" aria-hidden="true" />
      Aprovações
    </NuxtLink>
    <ErrorState v-if="failed" :kind="notFound ? 'not-found' : 'server'" :heading-level="2" @retry="load" />
    <BaseSkeleton v-else-if="!appointment" class="h-64 w-full rounded-xl" />
    <AgendaApprovalCard
      v-else-if="appointment.report?.status === 'SUBMITTED'"
      :appointment="appointment"
      @decided="decided"
    />
    <BaseEmptyState
      v-else
      title="Este relatório não espera aprovação"
      :text="
        appointment.report
          ? `Situação: ${REPORT_STATUS_LABELS[appointment.report.status].toLowerCase()}.`
          : 'O técnico ainda não finalizou este serviço.'
      "
    />
  </div>
</template>
