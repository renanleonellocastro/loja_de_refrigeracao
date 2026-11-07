<script setup lang="ts">
/** One record of a recent list on the profile: its name and status, then the date and details below. */
defineProps<{ to: string; title: string; details: string }>();
</script>

<template>
  <li>
    <NuxtLink :to="to" class="flex flex-col gap-1 py-3 hover:text-link">
      <span class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span class="font-semibold tabular-nums">{{ title }}</span>
        <slot name="status" />
      </span>
      <span class="text-sm text-text-muted tabular-nums">{{ details }}</span>
    </NuxtLink>
  </li>
</template>
