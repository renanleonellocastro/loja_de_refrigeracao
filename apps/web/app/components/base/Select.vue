<script setup lang="ts">
import { CONTROL_INPUT_CLASSES, controlFrameClasses } from '~/utils/ui';
import type { SelectOption } from '~/utils/types';
import { Check, ChevronDown } from 'lucide-vue-next';
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
} from 'reka-ui';

/** Searchable select (combobox): type to filter, arrows to move, Enter to pick, Escape to close. */
const props = withDefaults(
  defineProps<{
    label: string;
    options: SelectOption[];
    hint?: string;
    error?: string;
    placeholder?: string;
    emptyText?: string;
    required?: boolean;
    disabled?: boolean;
  }>(),
  {
    hint: undefined,
    error: undefined,
    placeholder: 'Selecione ou digite para buscar',
    emptyText: 'Nada encontrado com esse nome.',
  },
);

const model = defineModel<string | undefined>();

function labelOf(value: unknown): string {
  return props.options.find((option) => option.value === value)?.label ?? '';
}
</script>

<template>
  <BaseField :label="label" :hint="hint" :error="error" :required="required">
    <template #default="{ id, describedBy, invalid }">
      <ComboboxRoot v-model="model" :disabled="disabled" open-on-click class="relative">
        <ComboboxAnchor :class="[controlFrameClasses(invalid, disabled), 'pr-1.5']">
          <ComboboxInput
            :id="id"
            :display-value="labelOf"
            :placeholder="placeholder"
            :required="required"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedBy"
            :class="CONTROL_INPUT_CLASSES"
          />
          <ComboboxTrigger
            class="flex size-9 items-center justify-center rounded-sm text-text-muted transition-colors hover:text-text"
            tabindex="-1"
            aria-label="Abrir opções"
          >
            <ChevronDown
              class="size-5 transition-transform duration-200 group-has-[[data-state=open]]/control:rotate-180"
            />
          </ComboboxTrigger>
        </ComboboxAnchor>
        <ComboboxPortal>
          <ComboboxContent
            position="popper"
            :side-offset="6"
            class="z-50 max-h-72 w-(--reka-combobox-trigger-width) min-w-56 overflow-hidden rounded-lg border border-border bg-surface-raised shadow-lg data-[state=open]:animate-rc-rise"
          >
            <ComboboxViewport class="p-1.5">
              <ComboboxEmpty class="px-3 py-6 text-center text-sm text-text-muted">{{
                emptyText
              }}</ComboboxEmpty>
              <ComboboxItem
                v-for="option in options"
                :key="option.value"
                :value="option.value"
                :text-value="option.label"
                class="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-text outline-none select-none data-[highlighted]:bg-info-soft data-[highlighted]:text-on-info-soft data-[state=checked]:font-semibold"
              >
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate">{{ option.label }}</span>
                  <span v-if="option.description" class="truncate text-sm font-normal text-text-muted">
                    {{ option.description }}
                  </span>
                </span>
                <ComboboxItemIndicator class="text-link">
                  <Check class="size-5" aria-hidden="true" />
                </ComboboxItemIndicator>
              </ComboboxItem>
            </ComboboxViewport>
          </ComboboxContent>
        </ComboboxPortal>
      </ComboboxRoot>
    </template>
  </BaseField>
</template>
