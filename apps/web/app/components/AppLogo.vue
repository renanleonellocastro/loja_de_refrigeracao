<script setup lang="ts">
import logoRaw from '~/assets/brand/logo.svg?raw';
import symbolRaw from '~/assets/brand/simbolo.svg?raw';

/**
 * The storefront sign as inline SVG. It follows `currentColor`, or with `relief` gets the silver letters
 * with shadow used on the blue header and hero.
 */
const props = withDefaults(defineProps<{ variant?: 'full' | 'symbol'; relief?: boolean }>(), {
  variant: 'full',
});

const id = useId();
const svg = computed(() =>
  inlineLogoSvg(props.variant === 'full' ? logoRaw : symbolRaw, props.relief ? `logo-${id}` : undefined),
);
</script>

<template>
  <span role="img" aria-label="Refrigeração Castro" class="inline-block" v-html="svg" />
</template>
