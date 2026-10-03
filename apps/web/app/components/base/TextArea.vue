<script setup lang="ts">
import { CONTROL_INPUT_CLASSES, controlFrameClasses } from '~/utils/ui';
defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    label: string;
    hint?: string;
    error?: string;
    placeholder?: string;
    rows?: number;
    maxlength?: number;
    required?: boolean;
    disabled?: boolean;
  }>(),
  { hint: undefined, error: undefined, placeholder: undefined, rows: 4, maxlength: undefined },
);

const model = defineModel<string>({ default: '' });
const counter = computed(() => (props.maxlength ? `${model.value.length}/${props.maxlength}` : ''));
</script>

<template>
  <BaseField :label="label" :hint="hint" :error="error" :required="required">
    <template #default="{ id, describedBy, invalid }">
      <div :class="[controlFrameClasses(invalid, disabled), 'flex-col items-stretch py-1']">
        <textarea
          :id="id"
          v-model="model"
          v-bind="$attrs"
          :rows="rows"
          :maxlength="maxlength"
          :placeholder="placeholder"
          :required="required"
          :disabled="disabled"
          :aria-invalid="invalid || undefined"
          :aria-describedby="describedBy"
          :class="[CONTROL_INPUT_CLASSES, 'resize-y leading-relaxed']"
        />
        <span v-if="counter" class="self-end pb-1 text-xs tabular-nums text-text-muted">
          {{ counter }}
        </span>
      </div>
    </template>
  </BaseField>
</template>
