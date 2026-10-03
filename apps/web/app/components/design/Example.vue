<script setup lang="ts">
defineProps<{ title: string; note?: string }>();
</script>

<template>
  <div>
    <h3 class="text-sm font-semibold tracking-wide text-text-muted uppercase">{{ title }}</h3>
    <p v-if="note" class="mt-1 text-sm text-text-muted">{{ note }}</p>
    <div class="mt-4 rounded-lg border border-dashed border-border-strong/30 bg-surface p-5 sm:p-6">
      <slot />
    </div>
  </div>
</template>
