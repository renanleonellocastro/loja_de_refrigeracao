<script setup lang="ts">
withDefaults(defineProps<{ title: string; text?: string; headingLevel?: 2 | 3 }>(), {
  text: undefined,
  headingLevel: 2,
});
</script>

<template>
  <div class="flex flex-col items-center px-6 py-12 text-center">
    <div class="mb-5 text-castro-500 dark:text-castro-300" aria-hidden="true">
      <slot name="illustration">
        <IllustrationEmptyBox class="h-28 w-auto" />
      </slot>
    </div>
    <component :is="`h${headingLevel}`" class="text-xl font-bold text-text">{{ title }}</component>
    <p v-if="text" class="mt-2 max-w-md text-text-muted">{{ text }}</p>
    <div v-if="$slots.action" class="mt-6 flex flex-wrap justify-center gap-3"><slot name="action" /></div>
  </div>
</template>
