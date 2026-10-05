<script setup lang="ts">
import { ExternalLink, MapPin } from 'lucide-vue-next';
import { cityLine, mapsEmbedUrl, mapsSearchUrl, streetLine, type StorePublic } from '~/utils/store';

/**
 * Lightweight map: a static card with the address and a link to the maps app. The Google Maps embed loads
 * only when the person asks for it, so the page carries no map script on the first load.
 */
const props = defineProps<{ store: StorePublic }>();

const embedded = ref(false);
const searchUrl = computed(() => mapsSearchUrl(props.store.address));
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
    <div class="relative aspect-[4/3] w-full bg-info-soft sm:aspect-[16/10]">
      <iframe
        v-if="embedded"
        :src="mapsEmbedUrl(store.address)"
        :title="`Mapa: ${streetLine(store.address)}`"
        class="absolute inset-0 size-full border-0"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
      />
      <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <FrostLines class="pointer-events-none absolute inset-x-0 bottom-0 w-full text-frost-400/30" />
        <span
          class="relative flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-md"
        >
          <MapPin class="size-7" aria-hidden="true" />
        </span>
        <p class="relative font-semibold text-on-info-soft">
          {{ streetLine(store.address) }}<br />
          <span class="font-normal">{{ cityLine(store.address) }}</span>
        </p>
        <BaseButton variant="secondary" class="relative" @click="embedded = true">Mostrar mapa</BaseButton>
      </div>
    </div>
    <a
      :href="searchUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="flex min-h-12 items-center justify-center gap-2 border-t border-border px-4 font-semibold text-link hover:underline"
    >
      Abrir no Google Maps
      <ExternalLink class="size-4" aria-hidden="true" />
      <span class="sr-only">(abre em nova aba)</span>
    </a>
  </div>
</template>
