<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    /** Element for the title, to keep the page outline right. */
    headingLevel?: 2 | 3 | 4;
    padding?: 'none' | 'md' | 'lg';
    interactive?: boolean;
  }>(),
  { title: undefined, description: undefined, headingLevel: 2, padding: 'md' },
);
</script>

<template>
  <section
    class="flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
    :class="[
      interactive
        ? 'transition-[box-shadow,transform,border-color] duration-200 ease-brand hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md'
        : '',
    ]"
  >
    <header
      v-if="title || $slots.actions"
      class="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6"
    >
      <div class="min-w-0">
        <component :is="`h${headingLevel}`" v-if="title" class="text-lg font-bold text-text">{{
          title
        }}</component>
        <p v-if="description" class="mt-0.5 text-sm text-text-muted">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2"><slot name="actions" /></div>
    </header>
    <div :class="{ 'p-5 sm:p-6': padding === 'md', 'p-6 sm:p-8': padding === 'lg' }" class="flex-1">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="border-t border-border bg-surface-sunken/60 px-5 py-3 sm:px-6">
      <slot name="footer" />
    </footer>
  </section>
</template>
