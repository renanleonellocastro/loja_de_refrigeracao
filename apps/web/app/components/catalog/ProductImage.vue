<script setup lang="ts">
import type { ApiSchemas } from '@rc/contracts';

/**
 * Product photo with the API variants in srcset and its real size, so the browser picks the lightest file
 * and the layout does not jump. Without a photo, or when it fails to load, shows the store placeholder.
 */
const props = withDefaults(
  defineProps<{
    image: ApiSchemas['Image'] | null;
    alt: string;
    /** Rendered width hint for the browser, for example "(min-width: 1024px) 25vw, 50vw". */
    sizes?: string;
    /** Above the fold images load right away; the rest wait until they are near the screen. */
    eager?: boolean;
  }>(),
  { sizes: '(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw' },
);

const config = useRuntimeConfig();
const failed = ref(false);
watch(
  () => props.image?.url,
  () => {
    failed.value = false;
  },
);

const source = computed(() =>
  props.image && !failed.value
    ? {
        src: mediaUrl(config.public.apiBase, props.image.url),
        srcset: mediaSrcset(config.public.apiBase, props.image.srcset),
        width: props.image.width,
        height: props.image.height,
      }
    : null,
);
</script>

<template>
  <img
    v-if="source"
    :src="source.src"
    :srcset="source.srcset"
    :sizes="sizes"
    :width="source.width"
    :height="source.height"
    :alt="alt"
    :loading="eager ? 'eager' : 'lazy'"
    :fetchpriority="eager ? 'high' : undefined"
    decoding="async"
    class="size-full object-cover"
    @error="failed = true"
  />
  <img
    v-else
    src="/illustrations/produto-sem-foto.svg"
    width="320"
    height="320"
    :alt="alt ? `${alt}, sem foto` : ''"
    :loading="eager ? 'eager' : 'lazy'"
    :fetchpriority="eager ? 'high' : undefined"
    class="size-full object-cover"
  />
</template>
