<script setup lang="ts">
import { RECENT_LIST_SIZE } from '~/composables/useRecentList';

/**
 * Shell of a recent list on the profile: skeleton rows while loading, a short message with a way to start
 * when empty, and the rows with a link to the full list otherwise. Hidden when the list could not load.
 */
defineProps<{
  title: string;
  /** Full list of the customer, linked by "Ver todos". */
  allTo: string;
  emptyText: string;
  startTo: string;
  startLabel: string;
  loading: boolean;
  failed: boolean;
  empty: boolean;
}>();
</script>

<template>
  <BaseCard v-if="!failed" :title="title" :heading-level="2">
    <template v-if="!loading && !empty" #actions>
      <NuxtLink :to="allTo" class="text-sm font-semibold text-link hover:underline">Ver todos</NuxtLink>
    </template>
    <div v-if="loading" class="flex flex-col gap-3" role="status">
      <span class="sr-only">Carregando {{ title.toLowerCase() }}…</span>
      <BaseSkeleton v-for="n in RECENT_LIST_SIZE" :key="n" class="h-11 w-full rounded-md" />
    </div>
    <div v-else-if="empty" class="flex flex-col items-start gap-2 text-sm">
      <p class="text-text-muted">{{ emptyText }}</p>
      <NuxtLink :to="startTo" class="font-semibold text-link hover:underline">{{ startLabel }}</NuxtLink>
    </div>
    <ul v-else class="-my-3 divide-y divide-border">
      <slot />
    </ul>
  </BaseCard>
</template>
