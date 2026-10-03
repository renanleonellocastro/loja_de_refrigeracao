<script setup lang="ts">
import { CircleAlert } from 'lucide-vue-next';

/** Label, hint and inline error around a control. The slot receives the ids to wire aria attributes. */
const props = defineProps<{
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Visually hides the label while keeping it for screen readers. */
  hideLabel?: boolean;
}>();

const id = useId();
const hintId = `${id}-hint`;
const errorId = `${id}-error`;

const describedBy = computed(
  () => [props.error ? errorId : '', props.hint ? hintId : ''].filter(Boolean).join(' ') || undefined,
);
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5">
    <label :for="id" class="text-sm font-semibold text-text" :class="hideLabel ? 'sr-only' : ''">
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>
    <slot :id="id" :described-by="describedBy" :invalid="Boolean(error)" />
    <p v-if="error" :id="errorId" class="flex items-start gap-1.5 text-sm font-medium text-danger">
      <CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {{ error }}
    </p>
    <p v-if="hint" :id="hintId" class="text-sm text-text-muted">{{ hint }}</p>
  </div>
</template>
