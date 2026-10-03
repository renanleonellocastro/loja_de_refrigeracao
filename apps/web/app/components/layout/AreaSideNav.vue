<script setup lang="ts">
import { STORE_INFO } from '~/utils/store';
/**
 * One navigation for two sizes: an icon rail on tablets (768 to 1023 px) and a labeled sidebar on
 * desktops (1024 px and up). Hidden on phones, where AreaBottomNav takes over.
 */
defineProps<{ navigation: AreaNavigation }>();
</script>

<template>
  <aside
    class="rc-wall sticky top-0 hidden h-dvh w-24 shrink-0 flex-col overflow-y-auto md:flex lg:w-68"
    data-testid="side-nav"
  >
    <NuxtLink
      to="/"
      class="mx-auto mt-5 mb-4 flex h-12 items-center rounded-md px-1 lg:mx-6 lg:mt-7 lg:mb-6"
      aria-label="Refrigeração Castro, página inicial"
    >
      <span class="lg:hidden"><AppLogo variant="symbol" relief class="h-11" aria-hidden="true" /></span>
      <span class="hidden lg:block"><AppLogo relief class="h-11" aria-hidden="true" /></span>
    </NuxtLink>
    <nav aria-label="Área" class="flex flex-1 flex-col gap-5 px-2 pb-6 lg:px-4">
      <div v-for="group in navigation.groups" :key="group.label" class="flex flex-col gap-1">
        <p class="hidden px-3 pb-1 rc-eyebrow text-castro-200 lg:block">{{ group.label }}</p>
        <span class="mx-auto mb-1 h-px w-8 bg-white/15 lg:hidden" aria-hidden="true" />
        <NuxtLink
          v-for="item in group.items"
          :key="item.to"
          :to="item.to"
          class="group relative flex flex-col items-center gap-1 rounded-md px-1 py-2 text-center text-[0.6875rem] leading-tight font-semibold text-castro-100 transition-colors duration-150 hover:bg-white/10 hover:text-white aria-[current=page]:bg-white/14 aria-[current=page]:text-white lg:min-h-11 lg:flex-row lg:gap-3 lg:px-3 lg:py-0 lg:text-left lg:text-[0.9375rem] lg:font-medium"
        >
          <span
            class="absolute top-2 bottom-2 -left-2 w-1 rounded-r-full bg-frost-300 opacity-0 transition-opacity group-aria-[current=page]:opacity-100 lg:-left-4"
            aria-hidden="true"
          />
          <component :is="item.icon" class="size-5.5 shrink-0 lg:size-5" aria-hidden="true" />
          <span class="max-w-full truncate lg:max-w-none">{{ item.label }}</span>
        </NuxtLink>
      </div>
    </nav>
    <div class="hidden border-t border-white/10 px-6 py-4 text-xs text-castro-200 lg:block">
      {{ STORE_INFO.phone }} · Desde {{ STORE_INFO.since }}
    </div>
  </aside>
</template>
