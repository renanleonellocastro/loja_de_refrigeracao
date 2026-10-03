<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: undefined });
</script>

<template>
  <span
    class="inline-block shrink-0"
    :role="label ? 'status' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  >
    <svg
      class="size-full animate-spin motion-reduce:animate-[spin_3s_linear_infinite]"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-opacity="0.22" stroke-width="3" />
      <path
        d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
      />
    </svg>
  </span>
</template>
