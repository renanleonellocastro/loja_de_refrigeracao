<script setup lang="ts">
import { CONTROL_AFFIX_CLASSES, CONTROL_INPUT_CLASSES, controlFrameClasses } from '~/utils/ui';
defineOptions({ inheritAttrs: false });

withDefaults(
  defineProps<{
    label: string;
    hint?: string;
    error?: string;
    type?: 'text' | 'email' | 'tel' | 'search' | 'url' | 'number' | 'password';
    inputmode?: 'text' | 'email' | 'tel' | 'numeric' | 'decimal' | 'search' | 'url' | 'none';
    placeholder?: string;
    autocomplete?: string;
    prefix?: string;
    suffix?: string;
    required?: boolean;
    disabled?: boolean;
    hideLabel?: boolean;
  }>(),
  {
    hint: undefined,
    error: undefined,
    type: 'text',
    inputmode: undefined,
    placeholder: undefined,
    autocomplete: undefined,
    prefix: undefined,
    suffix: undefined,
  },
);

const model = defineModel<string>({ default: '' });
const input = useTemplateRef<HTMLInputElement>('input');

defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
  <BaseField :label="label" :hint="hint" :error="error" :required="required" :hide-label="hideLabel">
    <template #default="{ id, describedBy, invalid }">
      <div :class="controlFrameClasses(invalid, disabled)">
        <span v-if="prefix || $slots.prefix" :class="CONTROL_AFFIX_CLASSES">
          <slot name="prefix">{{ prefix }}</slot>
        </span>
        <input
          :id="id"
          ref="input"
          v-model="model"
          v-bind="$attrs"
          :type="type"
          :inputmode="inputmode"
          :placeholder="placeholder"
          :autocomplete="autocomplete"
          :required="required"
          :disabled="disabled"
          :aria-invalid="invalid || undefined"
          :aria-describedby="describedBy"
          :class="CONTROL_INPUT_CLASSES"
        />
        <span v-if="suffix || $slots.suffix" :class="CONTROL_AFFIX_CLASSES">
          <slot name="suffix">{{ suffix }}</slot>
        </span>
      </div>
    </template>
  </BaseField>
</template>
