<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next';
import { CONTROL_INPUT_CLASSES, controlFrameClasses } from '~/utils/ui';

/** Native select for short fixed lists (filters, category, movement type): works with the phone picker. */
withDefaults(
  defineProps<{
    label: string;
    options: SelectOption[];
    error?: string;
    hint?: string;
    /** Adds a disabled first option asking for a choice. */
    placeholder?: string;
    required?: boolean;
    hideLabel?: boolean;
  }>(),
  { error: undefined, hint: undefined, placeholder: undefined },
);

const model = defineModel<string>({ default: '' });
</script>

<template>
  <BaseField :label="label" :error="error" :hint="hint" :required="required" :hide-label="hideLabel">
    <template #default="{ id, describedBy, invalid }">
      <div :class="controlFrameClasses(invalid)" class="relative">
        <select
          :id="id"
          v-model="model"
          :class="[CONTROL_INPUT_CLASSES, 'cursor-pointer appearance-none pr-7']"
          :required="required"
          :aria-invalid="invalid || undefined"
          :aria-describedby="describedBy"
        >
          <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
          <option v-for="option in options" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <ChevronDown class="pointer-events-none absolute right-3 size-5 text-text-muted" aria-hidden="true" />
      </div>
    </template>
  </BaseField>
</template>
