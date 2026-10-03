<script setup lang="ts">
import { NuxtLink } from '#components';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Internal route or external URL; renders a link instead of a button. */
    to?: string;
    type?: 'button' | 'submit' | 'reset';
    loading?: boolean;
    disabled?: boolean;
    block?: boolean;
  }>(),
  { variant: 'primary', size: 'md', to: undefined, type: 'button' },
);

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-on-primary shadow-sm shadow-castro-950/20 inset-shadow-[0_1px_0_rgb(255_255_255/0.18)] hover:bg-primary-hover',
  secondary: 'border border-border bg-surface text-link shadow-sm hover:border-primary hover:bg-info-soft',
  ghost: 'text-link hover:bg-info-soft',
  danger: 'bg-danger text-on-danger shadow-sm hover:brightness-110',
};

// Small buttons keep a 44 px hit area through the ::after overlay (RNF-03).
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 px-3 text-sm after:absolute after:-inset-x-0 after:-inset-y-1',
  md: 'h-11 gap-2 px-5 text-[0.9375rem]',
  lg: 'h-13 gap-2.5 px-7 text-base',
};

const inactive = computed(() => props.disabled || props.loading);

const classes = computed(() => [
  'relative inline-flex shrink-0 select-none items-center justify-center rounded-md font-semibold whitespace-nowrap',
  'transition-[background-color,border-color,color,box-shadow,transform,filter] duration-150 ease-brand',
  'active:translate-y-px focus-visible:outline-offset-2',
  VARIANTS[props.variant],
  SIZES[props.size],
  props.block ? 'w-full' : '',
  inactive.value ? 'pointer-events-none opacity-60' : 'cursor-pointer',
]);
</script>

<template>
  <NuxtLink
    v-if="to"
    :to="to"
    :class="classes"
    :aria-disabled="inactive || undefined"
    :tabindex="inactive ? -1 : undefined"
  >
    <span v-if="$slots.icon" class="flex size-5 items-center justify-center" aria-hidden="true">
      <slot name="icon" />
    </span>
    <slot />
  </NuxtLink>
  <button v-else :type="type" :class="classes" :disabled="inactive" :aria-busy="loading || undefined">
    <BaseSpinner v-if="loading" class="size-5" />
    <span v-else-if="$slots.icon" class="flex size-5 items-center justify-center" aria-hidden="true">
      <slot name="icon" />
    </span>
    <slot />
  </button>
</template>
