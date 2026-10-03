<script setup lang="ts">
import { NuxtLink } from '#components';

const props = withDefaults(
  defineProps<{
    /** Required: an icon alone has no accessible name. */
    label: string;
    variant?: 'ghost' | 'secondary' | 'primary' | 'on-brand';
    size?: 'sm' | 'md';
    to?: string;
    disabled?: boolean;
    pressed?: boolean;
  }>(),
  { variant: 'ghost', size: 'md', to: undefined, pressed: undefined },
);

const VARIANTS = {
  ghost: 'text-text-muted hover:bg-surface-sunken hover:text-text',
  secondary: 'border border-border bg-surface text-text hover:border-primary hover:text-link',
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  'on-brand': 'text-on-brand-band hover:bg-white/12',
} as const;

const classes = computed(() => [
  'relative inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150 ease-brand',
  'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5',
  props.size === 'sm' ? 'size-9 after:absolute after:-inset-1' : 'size-11',
  VARIANTS[props.variant],
]);
</script>

<template>
  <NuxtLink v-if="to" :to="to" :class="classes" :aria-label="label" :title="label">
    <slot />
  </NuxtLink>
  <button
    v-else
    type="button"
    :class="classes"
    :aria-label="label"
    :title="label"
    :aria-pressed="pressed"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>
