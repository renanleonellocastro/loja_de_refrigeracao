<script setup lang="ts">
import { Ellipsis } from 'lucide-vue-next';

/** Phone navigation: up to four items of the role plus "Mais", which opens a sheet with the rest. */
defineProps<{ navigation: AreaNavigation }>();

const moreOpen = ref(false);
const route = useRoute();
watch(
  () => route.fullPath,
  () => {
    moreOpen.value = false;
  },
);

const ITEM =
  'group flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold text-text-muted transition-colors aria-[current=page]:text-link';
const PILL =
  'flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200 group-aria-[current=page]:bg-info-soft group-aria-[current=page]:text-on-info-soft';
</script>

<template>
  <nav
    aria-label="Área"
    class="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface-raised/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(9_29_53/0.06)] backdrop-blur-md md:hidden"
    data-testid="bottom-nav"
  >
    <ul class="flex px-1 pt-1">
      <li v-for="item in navigation.bottom" :key="item.to" class="flex flex-1">
        <NuxtLink :to="item.to" :class="ITEM">
          <span :class="PILL"><component :is="item.icon" class="size-5.5" aria-hidden="true" /></span>
          {{ item.label }}
        </NuxtLink>
      </li>
      <li v-if="navigation.more.length" class="flex flex-1">
        <button
          type="button"
          :class="ITEM"
          aria-haspopup="dialog"
          :aria-expanded="moreOpen"
          @click="moreOpen = true"
        >
          <span :class="PILL"><Ellipsis class="size-5.5" aria-hidden="true" /></span>
          Mais
        </button>
      </li>
    </ul>
    <BaseDialog v-model:open="moreOpen" title="Mais opções">
      <ul class="grid grid-cols-3 gap-2">
        <li v-for="item in navigation.more" :key="item.to">
          <NuxtLink
            :to="item.to"
            class="flex min-h-22 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-surface p-2 text-center text-sm font-medium text-text transition-colors hover:border-primary aria-[current=page]:border-primary aria-[current=page]:bg-info-soft"
          >
            <component :is="item.icon" class="size-6 text-link" aria-hidden="true" />
            {{ item.label }}
          </NuxtLink>
        </li>
      </ul>
      <div class="mt-5 border-t border-border pt-4">
        <p class="mb-2 text-sm font-semibold text-text">Tema</p>
        <ThemeToggle block />
      </div>
    </BaseDialog>
  </nav>
</template>
