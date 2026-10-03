<script setup lang="ts">
import type { TabItem } from '~/utils/types';
import { TabsContent, TabsIndicator, TabsList, TabsRoot, TabsTrigger } from 'reka-ui';

/** Tabs with arrow key navigation. Each panel is a slot named after the tab value. */
const props = defineProps<{ tabs: TabItem[]; label: string }>();
const model = defineModel<string>();

if (model.value === undefined) model.value = props.tabs[0]?.value;
</script>

<template>
  <TabsRoot v-model="model" class="flex flex-col gap-5">
    <TabsList
      :aria-label="label"
      class="relative flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]"
    >
      <TabsIndicator
        class="absolute bottom-0 left-0 h-0.75 w-(--reka-tabs-indicator-size) translate-x-(--reka-tabs-indicator-position) rounded-full bg-primary transition-[width,translate] duration-300 ease-brand"
      />
      <TabsTrigger
        v-for="tab in tabs"
        :key="tab.value"
        :value="tab.value"
        class="relative inline-flex h-11 shrink-0 items-center gap-2 rounded-t-md px-4 text-sm font-semibold text-text-muted transition-colors hover:text-text data-[state=active]:text-link"
      >
        {{ tab.label }}
        <span
          v-if="tab.count !== undefined"
          class="rounded-full bg-surface-sunken px-2 py-0.5 text-xs tabular-nums text-text-muted"
        >
          {{ tab.count }}
        </span>
      </TabsTrigger>
    </TabsList>
    <TabsContent
      v-for="tab in tabs"
      :key="tab.value"
      :value="tab.value"
      class="outline-none data-[state=active]:animate-rc-fade"
    >
      <slot :name="tab.value" />
    </TabsContent>
  </TabsRoot>
</template>
