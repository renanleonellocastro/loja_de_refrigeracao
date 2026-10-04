<script setup lang="ts">
import { mediaSrcset, mediaUrl } from '~/utils/catalog';

/** Photos of the problem sent with a request; each one opens in full size in a new tab. */
defineProps<{ photos: ServiceRequest['photos'] }>();

const config = useRuntimeConfig();
</script>

<template>
  <p v-if="photos.length === 0" class="text-sm text-text-muted">Nenhuma foto enviada.</p>
  <ul v-else class="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Fotos do problema">
    <li v-for="(photo, index) in photos" :key="photo.id">
      <a
        :href="mediaUrl(config.public.apiBase, photo.url)"
        target="_blank"
        rel="noopener"
        class="block aspect-square overflow-hidden rounded-md border border-border bg-surface-sunken transition-opacity hover:opacity-90"
      >
        <img
          :src="mediaUrl(config.public.apiBase, photo.url)"
          :srcset="mediaSrcset(config.public.apiBase, photo.srcset)"
          sizes="(min-width: 640px) 160px, 33vw"
          :width="photo.width"
          :height="photo.height"
          :alt="`Foto ${index + 1} do problema, abre em tamanho grande`"
          loading="lazy"
          class="size-full object-cover"
        />
      </a>
    </li>
  </ul>
</template>
