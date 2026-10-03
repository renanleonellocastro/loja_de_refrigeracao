<script setup lang="ts">
defineProps<{ id: string; title: string; description?: string }>();
</script>

<template>
  <section
    :id="id"
    :aria-labelledby="`${id}-titulo`"
    class="scroll-mt-28 border-t border-border py-12 first:border-t-0 sm:py-16"
  >
    <h2 :id="`${id}-titulo`" class="text-2xl font-extrabold text-text sm:text-3xl">{{ title }}</h2>
    <p v-if="description" class="mt-2 max-w-2xl text-text-muted">{{ description }}</p>
    <div class="mt-8 flex flex-col gap-10"><slot /></div>
  </section>
</template>
