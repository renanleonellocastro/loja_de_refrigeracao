<script setup lang="ts">
import { Eye, EyeOff } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    label?: string;
    hint?: string;
    error?: string;
    autocomplete?: 'current-password' | 'new-password';
    /** Shows the strength meter, for new passwords only. */
    showStrength?: boolean;
    required?: boolean;
  }>(),
  { label: 'Senha', hint: undefined, error: undefined, autocomplete: 'current-password' },
);

const model = defineModel<string>({ default: '' });
const visible = ref(false);
const strength = computed(() => passwordStrength(model.value));

const METER_COLORS: Record<PasswordStrength, string> = {
  0: 'bg-danger',
  1: 'bg-danger',
  2: 'bg-warning',
  3: 'bg-success',
  4: 'bg-success',
};

const meterHint = computed(() =>
  props.showStrength && model.value
    ? `Força da senha: ${STRENGTH_LABELS[strength.value]}.`
    : `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
);
</script>

<template>
  <div class="flex flex-col gap-2">
    <BaseTextField
      v-model="model"
      :label="label"
      :hint="showStrength ? undefined : hint"
      :error="error"
      :type="visible ? 'text' : 'password'"
      :autocomplete="autocomplete"
      :required="required"
      autocapitalize="off"
      spellcheck="false"
    >
      <template #suffix>
        <BaseIconButton
          size="sm"
          class="-mr-2"
          :label="visible ? 'Ocultar senha' : 'Mostrar senha'"
          :pressed="visible"
          @click="visible = !visible"
        >
          <EyeOff v-if="visible" />
          <Eye v-else />
        </BaseIconButton>
      </template>
    </BaseTextField>
    <div v-if="showStrength" class="grid grid-cols-4 gap-1.5" aria-hidden="true" data-testid="strength-meter">
      <span
        v-for="step in 4"
        :key="step"
        class="h-1.5 rounded-full transition-colors duration-200"
        :class="model && step <= Math.max(1, strength) ? METER_COLORS[strength] : 'bg-surface-sunken'"
      />
    </div>
    <p v-if="showStrength" class="-mt-0.5 text-sm text-text-muted" aria-live="polite">{{ meterHint }}</p>
  </div>
</template>
