<script setup lang="ts">
/** Stock and archive flags of a product for the staff lists and the edit page. */
defineProps<{ product: { archived: boolean; lowStock: boolean; stockAvailable: number } }>();
</script>

<template>
  <span class="inline-flex flex-wrap gap-1.5">
    <span
      v-if="product.archived"
      class="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-semibold text-text-muted ring-1 ring-border-strong/20"
      >Arquivado</span
    >
    <span
      v-if="product.stockAvailable <= 0"
      class="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-on-danger-soft"
      >Sem estoque</span
    >
    <span
      v-else-if="product.lowStock"
      class="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-on-warning-soft"
      >Estoque baixo</span
    >
  </span>
</template>
