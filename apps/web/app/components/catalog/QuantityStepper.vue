<script setup lang="ts">
import { Minus, Plus } from 'lucide-vue-next';

/** Quantity picker with large touch targets, limited to the stock (and to 99, the API limit). */
const props = withDefaults(
  defineProps<{ max: number; label?: string; disabled?: boolean; size?: 'sm' | 'md' }>(),
  { label: 'Quantidade', size: 'md' },
);
const model = defineModel<number>({ default: 1 });

const limit = computed(() => Math.max(1, Math.min(props.max, 99)));

function set(value: number): void {
  model.value = Math.min(limit.value, Math.max(1, Number.isFinite(value) ? Math.floor(value) : 1));
}

function onInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  set(Number.parseInt(input.value, 10));
  input.value = String(model.value);
}

const BUTTON =
  'flex shrink-0 items-center justify-center text-link transition-colors hover:bg-info-soft disabled:pointer-events-none disabled:opacity-40';
</script>

<template>
  <div
    class="inline-flex items-stretch overflow-hidden rounded-md border border-border-strong bg-surface"
    :class="size === 'sm' ? 'h-10' : 'h-12'"
    role="group"
    :aria-label="label"
  >
    <button
      type="button"
      :class="[BUTTON, size === 'sm' ? 'w-10' : 'w-12']"
      :disabled="disabled || model <= 1"
      aria-label="Diminuir quantidade"
      @click="set(model - 1)"
    >
      <Minus class="size-4" aria-hidden="true" />
    </button>
    <input
      :value="model"
      type="number"
      inputmode="numeric"
      min="1"
      :max="limit"
      :disabled="disabled"
      :aria-label="label"
      class="w-12 [appearance:textfield] border-x border-border bg-transparent text-center font-semibold text-text tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-focus focus-visible:ring-inset [&::-webkit-inner-spin-button]:appearance-none"
      @change="onInput"
    />
    <button
      type="button"
      :class="[BUTTON, size === 'sm' ? 'w-10' : 'w-12']"
      :disabled="disabled || model >= limit"
      aria-label="Aumentar quantidade"
      @click="set(model + 1)"
    >
      <Plus class="size-4" aria-hidden="true" />
    </button>
  </div>
</template>
