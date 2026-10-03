<script setup lang="ts">
const props = withDefaults(defineProps<{ name: string; src?: string; size?: 'sm' | 'md' | 'lg' }>(), {
  src: undefined,
  size: 'md',
});

const SIZES = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-16 text-xl' } as const;
const failed = ref(false);
const initials = computed(() => initialsOf(props.name));
</script>

<template>
  <span
    class="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-castro-500 to-castro-800 font-display font-bold tracking-wide text-white ring-2 ring-surface"
    :class="SIZES[size]"
  >
    <img v-if="src && !failed" :src="src" :alt="name" class="size-full object-cover" @error="failed = true" />
    <template v-else>
      <span aria-hidden="true">{{ initials }}</span>
      <span class="sr-only">{{ name }}</span>
    </template>
  </span>
</template>
