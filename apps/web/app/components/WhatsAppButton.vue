<script setup lang="ts">
import { whatsappHref } from '~/utils/store';

/** Floating WhatsApp button; `phone` is the store number with area code and no country code. */
const props = defineProps<{ phone: string; message?: string }>();

const href = computed(() => whatsappHref(props.phone, props.message));
</script>

<template>
  <a
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    class="group fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 inline-flex h-14 items-center gap-2 rounded-full bg-[#0F7A4F] pr-4 pl-3.5 font-semibold text-white shadow-lg ring-4 ring-white/70 transition-[transform,box-shadow] duration-200 ease-brand hover:-translate-y-0.5 hover:shadow-xl md:right-6 md:bottom-6 dark:ring-castro-950/60"
    aria-label="Conversar no WhatsApp (abre em nova aba)"
  >
    <svg viewBox="0 0 32 32" class="size-7 shrink-0" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16 3.5A12.5 12.5 0 0 0 5.3 22.4L3.6 28.5l6.3-1.6A12.5 12.5 0 1 0 16 3.5Zm0 22.7a10.2 10.2 0 0 1-5.2-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A10.2 10.2 0 1 1 16 26.2Z"
      />
      <path
        fill="currentColor"
        d="M21.6 18.6c-.3-.2-1.8-.9-2.1-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7 0a8.4 8.4 0 0 1-4.1-3.6c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.4 13.4 0 0 0 5.2 4.6c1.9.8 2.7.9 3.6.7a3 3 0 0 0 2-1.4 2.4 2.4 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.4Z"
      />
    </svg>
    <span class="text-[0.9375rem]">WhatsApp</span>
  </a>
</template>
