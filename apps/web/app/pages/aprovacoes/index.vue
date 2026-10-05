<script setup lang="ts">
/**
 * UC Aprovar Finalização: the reports sent by the technicians that wait for the management, oldest first.
 * The requests waiting for approval point to their visit, which carries the report and its photos.
 */
definePageMeta({ layout: 'area', permission: 'appointments.approve', title: 'Aprovações' });

const QUEUE_SIZE = 100;

const api = useApi();

const queue = ref<Appointment[]>([]);
const loading = ref(true);
const failed = ref(false);

async function visitOf(requestId: number): Promise<Appointment | null> {
  const request = await unwrap(
    api.GET('/api/v1/service-requests/{id}', { params: { path: { id: requestId } } }),
  );
  if (!request.appointment) return null;
  return unwrap(api.GET('/api/v1/appointments/{id}', { params: { path: { id: request.appointment.id } } }));
}

async function load(): Promise<void> {
  loading.value = true;
  failed.value = false;
  try {
    const waiting = await unwrap(
      api.GET('/api/v1/service-requests', {
        params: { query: { status: 'AWAITING_COMPLETION_APPROVAL', pageSize: QUEUE_SIZE } },
      }),
    );
    const visits = await Promise.all(waiting.data.map((item) => visitOf(item.id)));
    queue.value = visits
      .filter((item) => item?.report?.status === 'SUBMITTED')
      .map((item) => item!)
      .sort((a, b) => a.report!.submittedAt.localeCompare(b.report!.submittedAt));
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

function decided(appointment: Appointment): void {
  queue.value = queue.value.filter((item) => item.id !== appointment.id);
}

onMounted(load);
</script>

<template>
  <div class="mx-auto flex max-w-4xl flex-col gap-5">
    <p class="text-text-muted">
      Confira o relatório e as fotos de cada serviço. Aprove com o valor cobrado ou devolva ao técnico com o
      que precisa ser ajustado.
    </p>
    <p class="sr-only" role="status">{{ loading ? 'Carregando as aprovações…' : '' }}</p>
    <ErrorState v-if="failed" kind="server" :heading-level="2" @retry="load" />
    <div v-else-if="loading" class="flex flex-col gap-4">
      <BaseSkeleton v-for="n in 2" :key="n" class="h-64 w-full rounded-xl" />
    </div>
    <BaseEmptyState
      v-else-if="queue.length === 0"
      title="Nada para aprovar"
      text="Quando um técnico finalizar um serviço, o relatório aparece aqui."
    />
    <div v-else class="flex flex-col gap-4">
      <AgendaApprovalCard v-for="item in queue" :key="item.id" :appointment="item" @decided="decided" />
    </div>
  </div>
</template>
