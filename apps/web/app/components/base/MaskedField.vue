<script setup lang="ts">
import { CONTROL_INPUT_CLASSES, controlFrameClasses } from '~/utils/ui';
defineOptions({ inheritAttrs: false });

/**
 * Brazilian masked input. The model holds clean data: digits only for CPF, CNPJ, phone and CEP,
 * and an integer number of cents for money (typed from the right, like a card machine).
 */
const props = withDefaults(
  defineProps<{
    mask: MaskKind;
    label: string;
    hint?: string;
    error?: string;
    placeholder?: string;
    autocomplete?: string;
    required?: boolean;
    disabled?: boolean;
  }>(),
  { hint: undefined, error: undefined, placeholder: undefined, autocomplete: undefined },
);

const model = defineModel<string | number>({ default: '' });

const isMoney = computed(() => props.mask === 'money');
// Undefined for money, which has its own formatting below.
const config = computed(() => MASKS[props.mask as Exclude<MaskKind, 'money'>]);

const display = computed(() => {
  if (isMoney.value) return formatMoney(Number(model.value) || 0);
  return config.value!.format(String(model.value));
});

function onInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (isMoney.value) {
    model.value = parseMoney(input.value);
  } else {
    const formatted = config.value!.format(input.value);
    model.value = onlyDigits(formatted);
  }
  // The display may not change (for example an extra digit past the limit), so sync the DOM by hand.
  input.value = display.value;
}
</script>

<template>
  <BaseField :label="label" :hint="hint" :error="error" :required="required">
    <template #default="{ id, describedBy, invalid }">
      <div :class="controlFrameClasses(invalid, disabled)">
        <input
          :id="id"
          v-bind="$attrs"
          type="text"
          :value="display"
          :inputmode="isMoney ? 'numeric' : config!.inputmode"
          :placeholder="placeholder ?? (isMoney ? 'R$ 0,00' : config!.placeholder)"
          :maxlength="isMoney ? undefined : config!.maxLength"
          :autocomplete="autocomplete ?? 'off'"
          :required="required"
          :disabled="disabled"
          :aria-invalid="invalid || undefined"
          :aria-describedby="describedBy"
          :class="[CONTROL_INPUT_CLASSES, 'tabular-nums', isMoney ? 'text-right' : '']"
          @input="onInput"
        />
      </div>
    </template>
  </BaseField>
</template>
