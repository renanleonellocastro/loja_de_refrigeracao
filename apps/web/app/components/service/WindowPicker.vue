<script setup lang="ts">
import { CalendarPlus, X } from 'lucide-vue-next';
import {
  availableDays,
  formatDay,
  formatWindow,
  MAX_WINDOWS,
  PERIOD_LABELS,
  sortWindows,
  type VisitPeriod,
  type VisitWindow,
} from '~/utils/service-requests';

/** Days and periods that suit the customer: from tomorrow up to 60 days ahead, up to 10 choices. */
defineProps<{ error?: string }>();
const model = defineModel<VisitWindow[]>({ required: true });

const days = availableDays();
const dayOptions = days.map((day) => ({ value: day, label: formatDay(day) }));
const periodOptions = (Object.keys(PERIOD_LABELS) as VisitPeriod[]).map((value) => ({
  value,
  label: PERIOD_LABELS[value],
}));

const day = ref(days[0]!);
const period = ref<string>('MORNING');
const notice = ref('');

const full = computed(() => model.value.length >= MAX_WINDOWS);

function add(): void {
  const window = { day: day.value, period: period.value as VisitPeriod };
  if (model.value.some((item) => item.day === window.day && item.period === window.period)) {
    notice.value = 'Esse dia e período já estão na lista.';
    return;
  }
  model.value = sortWindows([...model.value, window]);
  notice.value = `${formatWindow(window)} adicionado.`;
}

function remove(window: VisitWindow): void {
  model.value = model.value.filter((item) => item !== window);
  notice.value = `${formatWindow(window)} removido.`;
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid gap-4 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
      <FormSelect v-model="day" label="Dia" :options="dayOptions" />
      <FormSelect v-model="period" label="Período" :options="periodOptions" />
      <BaseButton variant="secondary" :disabled="full" @click="add">
        <CalendarPlus class="size-5" aria-hidden="true" />
        Adicionar data
      </BaseButton>
    </div>
    <p class="text-sm text-text-muted" aria-live="polite">
      {{
        notice || 'Escolha quantas opções quiser, até 10. Mais opções ajudam a encaixar a visita mais cedo.'
      }}
    </p>

    <ul v-if="model.length" class="flex flex-col gap-2" aria-label="Datas escolhidas">
      <li
        v-for="window in model"
        :key="`${window.day}-${window.period}`"
        class="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface py-1 pr-1 pl-4"
      >
        <span class="text-text">{{ formatWindow(window) }}</span>
        <BaseIconButton :label="`Remover ${formatWindow(window)}`" @click="remove(window)">
          <X class="size-5" aria-hidden="true" />
        </BaseIconButton>
      </li>
    </ul>
    <p v-if="error" class="text-sm font-medium text-danger" role="alert">{{ error }}</p>
  </div>
</template>
