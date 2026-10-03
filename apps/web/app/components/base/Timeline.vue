<script setup lang="ts">
import type { TimelineEvent } from '~/utils/types';

/** Latest event first; the first item is highlighted as the current state. */
defineProps<{ events: TimelineEvent[]; label?: string }>();
</script>

<template>
  <ol class="relative flex flex-col" :aria-label="label ?? 'Histórico'">
    <li v-for="(event, index) in events" :key="event.id" class="relative flex gap-4 pb-6 last:pb-0">
      <span
        v-if="index < events.length - 1"
        class="absolute top-9 bottom-0 left-[17px] w-0.5 rounded-full bg-border"
        aria-hidden="true"
      />
      <span
        class="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full ring-4 ring-surface"
        :class="index === 0 ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-sunken text-text-muted'"
        aria-hidden="true"
      >
        <component :is="event.icon" v-if="event.icon" class="size-4.5" />
        <span v-else class="size-2 rounded-full bg-current" />
      </span>
      <div class="min-w-0 pt-1.5">
        <p class="font-semibold text-text">{{ event.title }}</p>
        <time :datetime="event.datetime" class="text-sm text-text-muted">{{ event.when }}</time>
        <p v-if="event.description" class="mt-1.5 text-sm text-text">{{ event.description }}</p>
      </div>
    </li>
  </ol>
</template>
