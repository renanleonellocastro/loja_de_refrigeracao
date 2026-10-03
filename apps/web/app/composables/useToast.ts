import { shallowRef } from 'vue';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastOptions {
  /** Short sentence in Portuguese. */
  title: string;
  description?: string;
  /** Shows a "Desfazer" button that runs this callback and closes the toast. */
  onUndo?: () => void;
  /** Milliseconds on screen; 0 keeps it until closed. Errors stay longer by default. */
  duration?: number;
}

export interface Toast extends ToastOptions {
  id: number;
  tone: ToastTone;
}

const DEFAULT_DURATION: Record<ToastTone, number> = { success: 5000, info: 5000, error: 8000 };

// Toasts are raised by user actions in the browser only, so module state is safe here (never set during SSR).
const toasts = shallowRef<Toast[]>([]);
const timers = new Map<number, ReturnType<typeof setTimeout>>();
let nextId = 1;

function dismiss(id: number): void {
  clearTimeout(timers.get(id));
  timers.delete(id);
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}

function show(tone: ToastTone, options: ToastOptions): number {
  const id = nextId++;
  toasts.value = [...toasts.value, { ...options, id, tone }];
  const duration = options.duration ?? DEFAULT_DURATION[tone];
  if (duration > 0)
    timers.set(
      id,
      setTimeout(() => dismiss(id), duration),
    );
  return id;
}

function undo(id: number): void {
  const toast = toasts.value.find((item) => item.id === id);
  toast?.onUndo?.();
  dismiss(id);
}

function clear(): void {
  for (const toast of toasts.value) dismiss(toast.id);
}

/** Non blocking feedback after an action (RNF-04), rendered by BaseToastRegion in app.vue. */
export function useToast() {
  return {
    toasts,
    success: (options: ToastOptions) => show('success', options),
    error: (options: ToastOptions) => show('error', options),
    info: (options: ToastOptions) => show('info', options),
    dismiss,
    undo,
    clear,
  };
}
