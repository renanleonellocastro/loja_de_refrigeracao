<script setup lang="ts">
import type { FormSteps } from '~/composables/useFormSteps';

/** Steps of a form on the phone: progress, a button per step and the heading of the step on screen. */
const props = defineProps<{ steps: FormSteps }>();

const current = computed(() => props.steps.current.value);
const total = computed(() => props.steps.steps.length);

function isLocked(index: number): boolean {
  return index === current.value || (!props.steps.free && index > props.steps.reached.value);
}
</script>

<template>
  <div v-if="steps.stepped.value" class="flex flex-col gap-3">
    <nav aria-label="Etapas do formulário">
      <ol class="flex gap-2">
        <li v-for="(step, index) in steps.steps" :key="step.key" class="min-w-0 flex-1">
          <button
            type="button"
            class="flex min-h-11 w-full flex-col gap-1.5 text-left text-xs font-semibold disabled:cursor-default"
            :class="index <= current ? 'text-link' : 'text-text-muted'"
            :disabled="isLocked(index)"
            :aria-current="index === current ? 'step' : undefined"
            @click="steps.goTo(index)"
          >
            <span
              class="h-1.5 w-full rounded-full"
              :class="index <= current ? 'bg-primary' : 'bg-surface-sunken'"
              aria-hidden="true"
            />
            <span class="truncate">{{ step.label }}</span>
          </button>
        </li>
      </ol>
    </nav>
    <h3 data-step-heading tabindex="-1" class="text-lg font-bold text-text outline-none">
      <span class="block text-sm font-semibold text-text-muted">Passo {{ current + 1 }} de {{ total }}</span>
      {{ steps.steps[current]!.label }}
    </h3>
  </div>
</template>
