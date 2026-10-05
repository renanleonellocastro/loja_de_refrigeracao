<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { addDays, formatLongDay, formatTimeRange, storeDay, technicianColor } from '~/utils/agenda';

/** Phone agenda: the visits of one day in order; swipe sideways or use the arrows to change the day. */
const props = defineProps<{
  day: string;
  appointments: Appointment[];
  loading: boolean;
  showTechnician: boolean;
}>();

const emit = defineEmits<{ change: [day: string] }>();

const SWIPE_MIN = 60;
let startX: number | null = null;
let startY = 0;

const isToday = computed(() => props.day === storeDay());
const sorted = computed(() => [...props.appointments].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));

function go(amount: number): void {
  emit('change', addDays(props.day, amount));
}

function touchStart(event: TouchEvent): void {
  startX = event.touches[0]!.clientX;
  startY = event.touches[0]!.clientY;
}

function touchEnd(event: TouchEvent): void {
  if (startX === null) return;
  const dx = event.changedTouches[0]!.clientX - startX;
  const dy = event.changedTouches[0]!.clientY - startY;
  startX = null;
  // A mostly vertical gesture is a scroll, not a swipe.
  if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy)) return;
  go(dx < 0 ? 1 : -1);
}
</script>

<template>
  <section
    class="flex flex-col gap-4"
    aria-labelledby="agenda-day-title"
    @touchstart.passive="touchStart"
    @touchend="touchEnd"
  >
    <div class="flex items-center justify-between gap-2">
      <BaseIconButton label="Dia anterior" variant="secondary" @click="go(-1)">
        <ChevronLeft class="size-5" aria-hidden="true" />
      </BaseIconButton>
      <div class="min-w-0 text-center">
        <h2 id="agenda-day-title" class="text-lg font-extrabold text-text first-letter:uppercase">
          {{ formatLongDay(day) }}
        </h2>
        <button
          v-if="!isToday"
          type="button"
          class="min-h-11 text-sm font-semibold text-link"
          @click="emit('change', storeDay())"
        >
          Voltar para hoje
        </button>
        <p v-else class="text-sm text-text-muted">Hoje</p>
      </div>
      <BaseIconButton label="Próximo dia" variant="secondary" @click="go(1)">
        <ChevronRight class="size-5" aria-hidden="true" />
      </BaseIconButton>
    </div>

    <p class="sr-only" role="status">{{ loading ? 'Carregando a agenda…' : '' }}</p>
    <div v-if="loading" class="flex flex-col gap-3">
      <BaseSkeleton v-for="n in 3" :key="n" class="h-24 w-full rounded-xl" />
    </div>
    <BaseEmptyState
      v-else-if="sorted.length === 0"
      title="Nenhum atendimento neste dia"
      text="Deslize para o lado ou use as setas para ver outros dias."
    />
    <ol v-else class="flex flex-col gap-3" aria-label="Atendimentos do dia">
      <li v-for="item in sorted" :key="item.id">
        <NuxtLink
          :to="`/agenda/${item.id}`"
          class="flex min-h-16 items-stretch gap-3 overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:bg-surface-sunken"
        >
          <span
            class="w-1.5 shrink-0"
            :style="{ backgroundColor: technicianColor(item.employee.id) }"
            aria-hidden="true"
          />
          <span class="flex min-w-0 flex-1 flex-col gap-0.5 py-3 pr-3">
            <span class="text-sm font-bold text-text">{{ formatTimeRange(item.startsAt, item.endsAt) }}</span>
            <span class="truncate font-semibold text-text">
              {{ item.request.serviceType }}: {{ item.request.customer.name }}
            </span>
            <span class="truncate text-sm text-text-muted">
              {{ item.request.address.district }}, {{ item.request.address.city }}
              <template v-if="showTechnician"> · {{ item.employee.name }}</template>
            </span>
          </span>
        </NuxtLink>
      </li>
    </ol>
  </section>
</template>
