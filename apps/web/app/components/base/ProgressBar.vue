<script setup lang="ts">
/** Determinate when `value` is given (0 to 100), indeterminate otherwise. */
const props = withDefaults(defineProps<{ label: string; value?: number; showValue?: boolean }>(), {
  value: undefined,
});

const clamped = computed(() =>
  props.value === undefined ? undefined : Math.round(Math.min(100, Math.max(0, props.value))),
);
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-baseline justify-between gap-3 text-sm">
      <span class="font-medium text-text">{{ label }}</span>
      <span v-if="showValue && clamped !== undefined" class="tabular-nums text-text-muted"
        >{{ clamped }}%</span
      >
    </div>
    <div
      class="relative h-2 overflow-hidden rounded-full bg-surface-sunken"
      role="progressbar"
      :aria-label="label"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="clamped"
    >
      <div
        v-if="clamped !== undefined"
        class="h-full rounded-full bg-gradient-to-r from-castro-500 to-frost-400 transition-[width] duration-300 ease-brand"
        :style="{ width: `${clamped}%` }"
      />
      <div
        v-else
        class="absolute inset-y-0 w-2/5 rounded-full bg-gradient-to-r from-castro-500 to-frost-400 animate-rc-indeterminate"
      />
    </div>
  </div>
</template>
