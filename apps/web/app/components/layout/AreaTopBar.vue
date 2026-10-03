<script setup lang="ts">
import { Bell } from 'lucide-vue-next';

defineProps<{ title: string }>();
</script>

<template>
  <header
    class="sticky top-0 z-20 border-b border-border bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur-md"
  >
    <div class="flex h-16 items-center gap-3 px-4 md:px-8">
      <NuxtLink
        to="/"
        class="-ml-1 flex size-11 items-center justify-center rounded-md text-link md:hidden"
        aria-label="Refrigeração Castro, página inicial"
      >
        <AppLogo variant="symbol" class="h-8" aria-hidden="true" />
      </NuxtLink>
      <h1 class="min-w-0 flex-1 truncate font-display text-xl font-extrabold text-text md:text-2xl">
        {{ title }}
      </h1>
      <slot name="notifications">
        <BaseIconButton label="Notificações" to="/notificacoes"><Bell /></BaseIconButton>
      </slot>
      <LayoutUserMenu />
    </div>
  </header>
</template>
