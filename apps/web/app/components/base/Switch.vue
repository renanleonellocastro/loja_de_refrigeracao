<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui';

defineProps<{ label: string; description?: string; disabled?: boolean }>();

const model = defineModel<boolean>({ default: false });
const id = useId();
</script>

<template>
  <div class="flex min-h-11 items-center justify-between gap-4" :class="disabled ? 'opacity-60' : ''">
    <span class="flex flex-col">
      <label :for="id" class="cursor-pointer font-medium text-text">{{ label }}</label>
      <span v-if="description" :id="`${id}-description`" class="text-sm text-text-muted">{{
        description
      }}</span>
    </span>
    <SwitchRoot
      :id="id"
      v-model="model"
      :disabled="disabled"
      :aria-describedby="description ? `${id}-description` : undefined"
      class="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-border-strong/60 transition-colors duration-200 ease-brand data-[state=checked]:bg-primary disabled:cursor-not-allowed"
    >
      <SwitchThumb
        class="block size-6 rounded-full bg-white shadow-md transition-transform duration-200 ease-brand data-[state=checked]:translate-x-5"
      />
    </SwitchRoot>
  </div>
</template>
