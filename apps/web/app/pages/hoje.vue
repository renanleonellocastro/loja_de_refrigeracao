<script setup lang="ts">
import { CheckCheck, Navigation, Phone } from 'lucide-vue-next';
import {
  dayRange,
  formatLongDay,
  formatTimeRange,
  mapsUrl,
  storeDay,
  REPORT_STATUS_LABELS,
} from '~/utils/agenda';
import { formatDateTime } from '~/utils/masks';
import { readDay, saveDay } from '~/utils/offline-day';

/** The technician's day: today's visits in order with call, route and finalize at thumb reach. */
definePageMeta({ layout: 'area', permission: 'appointments.complete', title: 'Hoje' });

const api = useApi();
const auth = useAuthStore();

const today = storeDay();
const visits = ref<Appointment[]>([]);
const loading = ref(true);
const failed = ref(false);
/** When the visits come from the copy saved on this phone, the time of that copy. */
const savedAt = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  failed.value = false;
  try {
    const result = await unwrap(api.GET('/api/v1/appointments', { params: { query: dayRange(today) } }));
    visits.value = result.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    savedAt.value = null;
    saveDay({ userId: auth.user!.id, day: today, savedAt: new Date().toISOString(), visits: visits.value });
  } catch {
    const saved = readDay(auth.user!.id, today);
    if (saved) {
      visits.value = saved.visits;
      savedAt.value = saved.savedAt;
    } else {
      failed.value = true;
    }
  } finally {
    loading.value = false;
  }
}

const pendingCount = computed(
  () => visits.value.filter((visit) => visit.request.status === 'SCHEDULED').length,
);

onMounted(load);
</script>

<template>
  <div class="mx-auto flex max-w-3xl flex-col gap-5">
    <div>
      <h2 class="text-2xl font-extrabold text-text first-letter:uppercase">{{ formatLongDay(today) }}</h2>
      <p v-if="!loading && !failed" class="text-text-muted" data-testid="today-summary">
        {{
          visits.length === 0
            ? 'Nenhuma visita hoje.'
            : `${visits.length} ${visits.length === 1 ? 'visita' : 'visitas'}, ${pendingCount} para finalizar.`
        }}
      </p>
    </div>

    <BaseAlert v-if="savedAt" tone="warning" title="Sem conexão com a loja">
      Mostrando as visitas salvas neste aparelho em {{ formatDateTime(savedAt) }}.
      <button type="button" class="font-semibold underline" @click="load">Tentar de novo</button>
    </BaseAlert>
    <p class="sr-only" role="status">{{ loading ? 'Carregando as visitas de hoje…' : '' }}</p>
    <ErrorState v-if="failed" kind="server" :heading-level="2" @retry="load" />
    <div v-else-if="loading" class="flex flex-col gap-4">
      <BaseSkeleton v-for="n in 2" :key="n" class="h-48 w-full rounded-xl" />
    </div>
    <BaseEmptyState
      v-else-if="visits.length === 0"
      title="Dia livre"
      text="Quando a loja marcar uma visita para você, ela aparece aqui e na agenda."
    />
    <ol v-else class="flex flex-col gap-4" aria-label="Visitas de hoje">
      <li
        v-for="visit in visits"
        :key="visit.id"
        class="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4"
        data-testid="today-visit"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xl font-extrabold text-text">
              {{ formatTimeRange(visit.startsAt, visit.endsAt) }}
            </p>
            <h3 class="font-bold text-text">
              <NuxtLink :to="`/agenda/${visit.id}`" class="underline-offset-4 hover:underline">
                {{ visit.request.serviceType }}: {{ visit.request.customer.name }}
              </NuxtLink>
            </h3>
            <p class="text-sm text-text-muted">
              {{ visit.request.address.street }}, {{ visit.request.address.number }} ·
              {{ visit.request.address.district }}
            </p>
          </div>
          <BaseStatusBadge kind="serviceRequest" :status="visit.request.status" />
        </div>
        <p
          v-if="visit.report?.status === 'REWORK'"
          class="rounded-md bg-warning-soft p-3 text-sm text-on-warning-soft"
        >
          <strong>{{ REPORT_STATUS_LABELS.REWORK }}:</strong> {{ visit.report.reworkComment }}
        </p>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <BaseButton
            v-if="visit.request.customer.phone"
            :to="`tel:${visit.request.customer.phone}`"
            variant="secondary"
            size="lg"
          >
            <Phone class="size-5" aria-hidden="true" />
            Ligar
          </BaseButton>
          <BaseButton :to="mapsUrl(visit.request.address)" variant="secondary" size="lg">
            <Navigation class="size-5" aria-hidden="true" />
            Rota
          </BaseButton>
          <BaseButton
            v-if="visit.request.status === 'SCHEDULED'"
            :to="`/agenda/${visit.id}#finalizar`"
            size="lg"
            class="col-span-2 sm:col-span-1"
          >
            <CheckCheck class="size-5" aria-hidden="true" />
            Finalizar serviço
          </BaseButton>
        </div>
      </li>
    </ol>
  </div>
</template>
