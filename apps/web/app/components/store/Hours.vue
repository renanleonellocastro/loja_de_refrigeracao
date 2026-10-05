<script setup lang="ts">
import { Clock } from 'lucide-vue-next';
import { openingHoursLines, type StorePublic } from '~/utils/store';

/** Weekly opening hours with the "aberto agora" badge computed by the API in store time. */
const props = defineProps<{ store: StorePublic }>();

const lines = computed(() => openingHoursLines(props.store.openingHours));
</script>

<template>
  <div>
    <p
      class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold"
      :class="store.openNow ? 'bg-success-soft text-on-success-soft' : 'bg-surface-sunken text-text-muted'"
      data-testid="open-now"
    >
      <span
        class="size-2 rounded-full"
        :class="store.openNow ? 'bg-success' : 'bg-text-muted'"
        aria-hidden="true"
      />
      {{ store.openNow ? 'Aberto agora' : 'Fechado agora' }}
    </p>
    <dl class="mt-3 grid gap-1.5">
      <div v-for="line in lines" :key="line.days" class="flex items-start gap-2.5">
        <Clock class="mt-0.5 size-4.5 shrink-0 text-link" aria-hidden="true" />
        <dt class="font-semibold text-text">{{ line.days }}:</dt>
        <dd class="text-text-muted">{{ line.hours }}</dd>
      </div>
    </dl>
  </div>
</template>
