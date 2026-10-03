<script setup lang="ts">
import type { Crumb } from '~/utils/types';
import { ChevronRight } from 'lucide-vue-next';

defineProps<{ items: Crumb[] }>();
</script>

<template>
  <nav aria-label="Você está em">
    <ol class="flex flex-wrap items-center gap-1 text-sm">
      <li v-for="(crumb, index) in items" :key="crumb.label" class="flex items-center gap-1">
        <ChevronRight v-if="index > 0" class="size-4 text-text-muted" aria-hidden="true" />
        <NuxtLink
          v-if="crumb.to && index < items.length - 1"
          :to="crumb.to"
          class="-mx-1 inline-flex min-h-11 items-center rounded-sm px-1 text-text-muted underline-offset-4 hover:text-link hover:underline"
        >
          {{ crumb.label }}
        </NuxtLink>
        <span v-else aria-current="page" class="inline-flex min-h-11 items-center font-semibold text-text">
          {{ crumb.label }}
        </span>
      </li>
    </ol>
  </nav>
</template>
