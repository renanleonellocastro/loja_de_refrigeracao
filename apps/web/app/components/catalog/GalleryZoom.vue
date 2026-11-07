<script setup lang="ts">
import { ChevronLeft, ChevronRight, Minus, Plus, X } from 'lucide-vue-next';
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui';

/**
 * Full screen viewer of the product photos. Pinch, double tap, the mouse wheel, the buttons and the + and - keys
 * zoom; a finger, the mouse or the arrow keys move the zoomed photo; a swipe or the arrows change the photo.
 * Loaded only when the customer opens it, so it costs nothing on the product page load.
 */
const props = defineProps<{ images: ProductImage[]; name: string }>();
const emit = defineEmits<{ closed: [event: Event] }>();
const open = defineModel<boolean>('open', { required: true });
const index = defineModel<number>('index', { required: true });

type ProductImage = ProductDetail['images'][number];

const stage = ref<HTMLElement | null>(null);
const stageBounds = (): DOMRectReadOnly => stage.value!.getBoundingClientRect();
const view = reactive(new ZoomView(stageBounds)) as ZoomView;
const gestures = new ZoomGestures({ view, stageBounds, onSwipe: go });
/** Off while a finger or the mouse drives the photo, so it follows without lag; on for buttons and keys. */
const isAnimated = ref(true);
const image = computed(() => props.images[index.value]!);

function go(step: PhotoStep): void {
  const target = Math.min(props.images.length - 1, Math.max(0, index.value + step));
  if (target === index.value) return;
  index.value = target;
  view.reset();
}

function onPointerDown(event: PointerEvent): void {
  isAnimated.value = false;
  // Keeps the drag alive when the mouse leaves the stage, so the pointer is never left half pressed.
  stage.value!.setPointerCapture(event.pointerId);
  gestures.down(event);
}

function onKeydown(event: KeyboardEvent): void {
  isAnimated.value = true;
  if (handleZoomKey(event.key, view, go)) event.preventDefault();
}

function zoomIn(): void {
  isAnimated.value = true;
  view.zoomBy(ZOOM_STEP);
}

function zoomOut(): void {
  isAnimated.value = true;
  view.zoomBy(1 / ZOOM_STEP);
}

function focusStage(event: Event): void {
  event.preventDefault();
  stage.value!.focus();
}

watch(open, () => view.reset());

const CONTROL =
  'flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-white/10';
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-castro-950 data-[state=open]:animate-rc-fade" />
      <DialogContent
        class="fixed inset-0 z-50 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-white outline-none data-[state=open]:animate-rc-fade"
        @keydown="onKeydown"
        @open-auto-focus="focusStage"
        @close-auto-focus="emit('closed', $event)"
      >
        <header class="flex items-center gap-2 px-3 py-2 sm:px-5 sm:py-3">
          <DialogTitle class="min-w-0 flex-1 truncate font-display text-lg font-bold">{{ name }}</DialogTitle>
          <DialogDescription class="sr-only">
            Toque duas vezes, afaste dois dedos ou use a roda do mouse para ampliar. As teclas mais e menos
            ampliam e reduzem, zero volta ao tamanho original e as setas movem a foto ampliada ou trocam de
            foto.
          </DialogDescription>
          <button
            type="button"
            :class="CONTROL"
            :disabled="!view.isZoomed"
            aria-label="Reduzir"
            @click="zoomOut"
          >
            <Minus class="size-5" aria-hidden="true" />
          </button>
          <p class="w-12 text-center text-sm font-semibold tabular-nums" aria-live="polite">
            {{ view.percent }}%
          </p>
          <button
            type="button"
            :class="CONTROL"
            :disabled="!view.canZoomIn"
            aria-label="Ampliar"
            @click="zoomIn"
          >
            <Plus class="size-5" aria-hidden="true" />
          </button>
          <DialogClose :class="[CONTROL, 'ml-2']" aria-label="Fechar">
            <X class="size-5" aria-hidden="true" />
          </DialogClose>
        </header>
        <div
          ref="stage"
          class="relative min-h-0 flex-1 touch-none overflow-hidden outline-none select-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-inset"
          :class="view.isZoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'"
          tabindex="0"
          role="group"
          aria-roledescription="foto ampliável"
          :aria-label="`Foto ${index + 1} de ${images.length}`"
          @pointerdown="onPointerDown"
          @pointermove="gestures.move($event)"
          @pointerup="gestures.up($event)"
          @pointercancel="gestures.up($event)"
          @wheel.prevent="gestures.wheel($event)"
        >
          <div
            v-dynamic-style="{ transform: view.transform }"
            class="size-full will-change-transform"
            :class="{
              'transition-transform duration-200 ease-out motion-reduce:transition-none': isAnimated,
            }"
          >
            <CatalogProductImage
              :key="image.id"
              :image="image"
              :alt="index === 0 ? name : `${name}, foto ${index + 1}`"
              sizes="100vw"
              fit="contain"
              eager
              draggable="false"
            />
          </div>
        </div>
        <footer v-if="images.length > 1" class="flex items-center justify-center gap-4 px-3 py-2 sm:py-3">
          <button
            type="button"
            :class="CONTROL"
            :disabled="index === 0"
            aria-label="Foto anterior"
            @click="go(-1)"
          >
            <ChevronLeft class="size-5" aria-hidden="true" />
          </button>
          <p class="text-sm font-semibold tabular-nums" aria-live="polite">
            {{ index + 1 }}/{{ images.length }}
          </p>
          <button
            type="button"
            :class="CONTROL"
            :disabled="index === images.length - 1"
            aria-label="Próxima foto"
            @click="go(1)"
          >
            <ChevronRight class="size-5" aria-hidden="true" />
          </button>
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
