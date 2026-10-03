<script setup lang="ts">
import { CircleAlert, CircleCheck, Info, X } from 'lucide-vue-next';

/** Live region for useToast(). Mounted once in app.vue, above the phone bottom bar. */
const { toasts, dismiss, undo } = useToast();

const TONES = {
  success: { icon: CircleCheck, accent: 'bg-success', iconClass: 'text-success' },
  error: { icon: CircleAlert, accent: 'bg-danger', iconClass: 'text-danger' },
  info: { icon: Info, accent: 'bg-primary', iconClass: 'text-link' },
} as const;
</script>

<template>
  <section
    aria-label="Notificações"
    class="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:right-6 md:bottom-6 md:left-auto md:items-end md:px-0"
  >
    <div aria-live="polite" aria-atomic="false" class="flex w-full flex-col items-center gap-2 md:items-end">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :role="toast.tone === 'error' ? 'alert' : 'status'"
        class="pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-lg border border-border bg-surface-raised py-3 pr-2 pl-4 shadow-lg animate-rc-rise"
      >
        <span class="absolute inset-y-0 left-0 w-1" :class="TONES[toast.tone].accent" aria-hidden="true" />
        <component
          :is="TONES[toast.tone].icon"
          class="mt-0.5 size-5 shrink-0"
          :class="TONES[toast.tone].iconClass"
          aria-hidden="true"
        />
        <div class="min-w-0 flex-1 py-0.5">
          <p class="font-semibold text-text">{{ toast.title }}</p>
          <p v-if="toast.description" class="mt-0.5 text-sm text-text-muted">{{ toast.description }}</p>
        </div>
        <button
          v-if="toast.onUndo"
          type="button"
          class="h-11 shrink-0 rounded-md px-3 text-sm font-bold text-link hover:bg-info-soft"
          @click="undo(toast.id)"
        >
          Desfazer
        </button>
        <button
          type="button"
          class="flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface-sunken hover:text-text"
          aria-label="Fechar notificação"
          @click="dismiss(toast.id)"
        >
          <X class="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  </section>
</template>
