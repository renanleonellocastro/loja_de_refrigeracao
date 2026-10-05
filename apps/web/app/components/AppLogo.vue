<script setup lang="ts">
/**
 * The storefront sign, loaded as an image file so its SVG paths stay out of the HTML and the JavaScript.
 * With `relief` it shows the silver letters with shadow used on the blue header and hero; otherwise it
 * follows `currentColor` through a CSS mask.
 */
const props = withDefaults(defineProps<{ variant?: 'full' | 'symbol'; relief?: boolean }>(), {
  variant: 'full',
});

const LOGOS = {
  full: { relief: '/brand/logo-prata.svg', mask: '/brand/logo-mono.svg', width: 1363, height: 436 },
  symbol: { relief: '/brand/simbolo-prata.svg', mask: '/brand/simbolo-azul.svg', width: 480, height: 480 },
} as const;

const logo = computed(() => LOGOS[props.variant]);
const maskStyle = computed(() => ({
  aspectRatio: `${logo.value.width} / ${logo.value.height}`,
  mask: `url(${logo.value.mask}) center / contain no-repeat`,
}));
</script>

<template>
  <img
    v-if="relief"
    :src="logo.relief"
    alt="Refrigeração Castro"
    :width="logo.width"
    :height="logo.height"
    class="block w-auto max-w-none"
  />
  <span
    v-else
    role="img"
    aria-label="Refrigeração Castro"
    class="inline-block bg-current"
    :style="maskStyle"
  />
</template>
