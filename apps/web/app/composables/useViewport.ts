import type { Ref } from 'vue';

export type Viewport = 'phone' | 'tablet' | 'desktop';

/** Breakpoints of docs/DESIGN.md section 3: phone up to 767 px, tablet up to 1023 px, desktop above. */
export function viewportFor(width: number): Viewport {
  if (width < 768) return 'phone';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

/** Device class of the current window, updated when it is resized or rotated. Browser only (signed in pages). */
export function useViewport(): Ref<Viewport> {
  const viewport = ref<Viewport>(viewportFor(window.innerWidth));
  const update = () => {
    viewport.value = viewportFor(window.innerWidth);
  };
  onMounted(() => window.addEventListener('resize', update));
  onBeforeUnmount(() => window.removeEventListener('resize', update));
  return viewport;
}
