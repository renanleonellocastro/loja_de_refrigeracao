<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';

/**
 * Product photos: swipe between them on touch screens (native scroll snap), arrows and thumbnails
 * everywhere. Without photos it shows the store placeholder.
 */
const props = defineProps<{ images: ProductImage[]; name: string }>();

type ProductImage = ProductDetail['images'][number];

const track = ref<HTMLElement | null>(null);
const current = ref(0);

function onScroll(): void {
  const element = track.value!;
  current.value = Math.round(element.scrollLeft / Math.max(element.clientWidth, 1));
}

function show(index: number): void {
  const target = Math.min(props.images.length - 1, Math.max(0, index));
  current.value = target;
  const element = track.value!;
  element.scrollTo({ left: target * element.clientWidth, behavior: 'smooth' });
}

const ARROW =
  'absolute top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface-raised/90 text-text shadow-md transition-opacity hover:bg-surface-raised disabled:opacity-0 sm:flex';
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="relative overflow-hidden rounded-xl border border-border bg-surface-sunken">
      <div
        v-if="images.length > 0"
        ref="track"
        class="flex aspect-square snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
        tabindex="0"
        :aria-label="`Fotos de ${name}`"
        role="region"
        aria-roledescription="galeria"
        @scroll.passive="onScroll"
      >
        <div
          v-for="(image, index) in images"
          :key="image.id"
          class="aspect-square w-full shrink-0 snap-center"
          :aria-label="`Foto ${index + 1} de ${images.length}`"
          role="group"
        >
          <CatalogProductImage
            :image="image"
            :alt="index === 0 ? name : `${name}, foto ${index + 1}`"
            sizes="(min-width: 1024px) 50vw, 100vw"
            :eager="index === 0"
          />
        </div>
      </div>
      <div v-else class="aspect-square">
        <CatalogProductImage :image="null" :alt="name" />
      </div>
      <template v-if="images.length > 1">
        <button
          type="button"
          :class="[ARROW, 'left-3']"
          :disabled="current === 0"
          aria-label="Foto anterior"
          @click="show(current - 1)"
        >
          <ChevronLeft class="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          :class="[ARROW, 'right-3']"
          :disabled="current === images.length - 1"
          aria-label="Próxima foto"
          @click="show(current + 1)"
        >
          <ChevronRight class="size-5" aria-hidden="true" />
        </button>
        <p
          class="absolute right-3 bottom-3 rounded-full bg-castro-950/70 px-2.5 py-0.5 text-xs font-semibold text-white tabular-nums sm:hidden"
          aria-live="polite"
        >
          {{ current + 1 }}/{{ images.length }}
        </p>
      </template>
    </div>
    <ul v-if="images.length > 1" class="flex gap-2 overflow-x-auto pb-1" aria-label="Miniaturas">
      <li v-for="(image, index) in images" :key="image.id" class="shrink-0">
        <button
          type="button"
          class="block size-16 overflow-hidden rounded-md border-2 bg-surface-sunken transition-colors sm:size-20"
          :class="index === current ? 'border-primary' : 'border-transparent opacity-75 hover:opacity-100'"
          :aria-label="`Ver foto ${index + 1}`"
          :aria-current="index === current ? 'true' : undefined"
          @click="show(index)"
        >
          <CatalogProductImage :image="image" alt="" sizes="80px" />
        </button>
      </li>
    </ul>
  </div>
</template>
