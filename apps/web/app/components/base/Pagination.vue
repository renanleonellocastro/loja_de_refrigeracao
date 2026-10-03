<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';

const props = defineProps<{ total: number; label?: string }>();
const page = defineModel<number>('page', { default: 1 });

const slots = computed(() => pageSlots(page.value, props.total));

function go(target: number): void {
  page.value = Math.min(props.total, Math.max(1, target));
}

const BASE =
  'inline-flex size-11 items-center justify-center rounded-md text-sm font-semibold tabular-nums transition-colors duration-150';
</script>

<template>
  <nav v-if="total > 1" :aria-label="label ?? 'Paginação'" class="flex items-center justify-center gap-1">
    <button
      type="button"
      :class="[BASE, 'text-link hover:bg-info-soft disabled:pointer-events-none disabled:opacity-40']"
      :disabled="page <= 1"
      aria-label="Página anterior"
      @click="go(page - 1)"
    >
      <ChevronLeft class="size-5" aria-hidden="true" />
    </button>
    <!-- Phones show "3 de 12"; larger screens show the numbered pages. -->
    <span class="px-3 text-sm font-medium text-text-muted tabular-nums sm:hidden" aria-live="polite">
      {{ page }} de {{ total }}
    </span>
    <ul class="hidden items-center gap-1 sm:flex">
      <li v-for="(slot, index) in slots" :key="`${slot}-${index}`">
        <span v-if="slot === 'gap'" class="inline-flex w-8 justify-center text-text-muted" aria-hidden="true"
          >…</span
        >
        <button
          v-else
          type="button"
          :class="[
            BASE,
            slot === page ? 'bg-primary text-on-primary shadow-sm' : 'text-text hover:bg-surface-sunken',
          ]"
          :aria-current="slot === page ? 'page' : undefined"
          :aria-label="`Página ${slot}`"
          @click="go(slot)"
        >
          {{ slot }}
        </button>
      </li>
    </ul>
    <button
      type="button"
      :class="[BASE, 'text-link hover:bg-info-soft disabled:pointer-events-none disabled:opacity-40']"
      :disabled="page >= total"
      aria-label="Próxima página"
      @click="go(page + 1)"
    >
      <ChevronRight class="size-5" aria-hidden="true" />
    </button>
  </nav>
</template>
