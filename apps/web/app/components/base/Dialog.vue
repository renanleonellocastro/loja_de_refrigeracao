<script setup lang="ts">
import { X } from 'lucide-vue-next';
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
 * Modal dialog with focus trap, Escape to close and focus return. On phones it rises from the bottom
 * as a sheet; from tablets up it is centered.
 */
withDefaults(
  defineProps<{
    title: string;
    description?: string;
    size?: 'sm' | 'md' | 'lg';
    /** Hides the close button, for flows that must end with an explicit choice. */
    hideClose?: boolean;
  }>(),
  { description: undefined, size: 'md' },
);

const open = defineModel<boolean>('open', { default: false });

const SIZES = { sm: 'md:max-w-md', md: 'md:max-w-lg', lg: 'md:max-w-2xl' } as const;
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-50 bg-castro-950/55 backdrop-blur-[2px] data-[state=open]:animate-rc-fade"
      />
      <DialogContent
        class="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-xl border border-border bg-surface-raised pb-[env(safe-area-inset-bottom)] shadow-lg outline-none data-[state=open]:animate-rc-slide-up md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-[calc(100%-4rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:pb-0 md:data-[state=open]:animate-rc-rise"
        :class="SIZES[size]"
      >
        <span
          class="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border md:hidden"
          aria-hidden="true"
        />
        <header class="flex items-start gap-3 px-5 pt-4 sm:px-6 md:pt-6">
          <slot name="icon" />
          <div class="min-w-0 flex-1">
            <DialogTitle class="font-display text-xl font-bold text-text">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="mt-1 text-text-muted">{{
              description
            }}</DialogDescription>
          </div>
          <DialogClose
            v-if="!hideClose"
            class="-mt-1.5 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-sunken hover:text-text"
            aria-label="Fechar"
          >
            <X class="size-5" aria-hidden="true" />
          </DialogClose>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6"><slot /></div>
        <footer
          v-if="$slots.footer"
          class="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6"
        >
          <slot name="footer" />
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
