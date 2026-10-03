<script setup lang="ts">
import { Check } from 'lucide-vue-next';
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui';

defineProps<{ label: string; description?: string; disabled?: boolean }>();

const model = defineModel<boolean>({ default: false });
const id = useId();
</script>

<template>
  <div class="flex items-start gap-3" :class="disabled ? 'opacity-60' : ''">
    <!-- The 44 px row is the hit area; the visible box stays 22 px. -->
    <span class="flex h-11 shrink-0 items-center">
      <CheckboxRoot
        :id="id"
        v-model="model"
        :disabled="disabled"
        :aria-describedby="description ? `${id}-description` : undefined"
        class="flex size-5.5 items-center justify-center rounded-sm border-2 border-border-strong bg-surface text-on-primary transition-colors duration-150 hover:border-primary data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:cursor-not-allowed"
      >
        <CheckboxIndicator class="data-[state=checked]:animate-rc-rise">
          <Check class="size-4" :stroke-width="3" aria-hidden="true" />
        </CheckboxIndicator>
      </CheckboxRoot>
    </span>
    <span class="flex min-h-11 flex-col justify-center py-2.5">
      <label :for="id" class="cursor-pointer leading-snug font-medium text-text">{{ label }}</label>
      <span v-if="description" :id="`${id}-description`" class="text-sm text-text-muted">{{
        description
      }}</span>
    </span>
  </div>
</template>
