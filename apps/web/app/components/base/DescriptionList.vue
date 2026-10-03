<script setup lang="ts">
import type { DescriptionItem } from '~/utils/types';
/** Label and value pairs. Slot `#detail-<index>` replaces a value with rich content. */
withDefaults(defineProps<{ items: DescriptionItem[]; columns?: 1 | 2 }>(), { columns: 1 });
</script>

<template>
  <dl class="grid gap-x-8" :class="columns === 2 ? 'sm:grid-cols-2' : ''">
    <div
      v-for="(item, index) in items"
      :key="item.term"
      class="flex flex-col gap-1 border-b border-border py-3"
      :class="columns === 2 ? '' : 'last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4'"
    >
      <dt class="shrink-0 text-sm font-medium text-text-muted" :class="columns === 2 ? '' : 'sm:w-44'">
        {{ item.term }}
      </dt>
      <dd class="min-w-0 text-text">
        <slot :name="`detail-${index}`" :item="item">{{ item.detail }}</slot>
      </dd>
    </div>
  </dl>
</template>
