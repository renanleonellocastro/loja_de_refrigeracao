<script setup lang="ts">
import { formatMoney } from '~/utils/masks';

/** Catalog card: photo, condition, name, brand and price. Unavailable products stay visible but faded. */
defineProps<{ product: ProductSummary; eager?: boolean; headingLevel?: 2 | 3 }>();
</script>

<template>
  <article
    class="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-shadow duration-200 hover:shadow-md"
    :data-available="product.available"
  >
    <div
      class="relative aspect-square overflow-hidden bg-surface-sunken"
      :class="{ 'opacity-55': !product.available }"
    >
      <CatalogProductImage
        :image="product.cover"
        :alt="product.name"
        :eager="eager"
        class="transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
      />
    </div>
    <div class="absolute top-2 left-2 flex flex-wrap gap-1.5">
      <span
        v-if="!product.available"
        class="rounded-full bg-surface-raised px-2.5 py-0.5 text-xs font-bold text-text shadow-sm"
        >Indisponível</span
      >
      <span
        v-if="product.condition === 'USED'"
        class="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-on-warning-soft"
        >Usado</span
      >
    </div>
    <div class="flex flex-1 flex-col gap-1 p-3 sm:p-4">
      <p class="text-xs font-medium text-text-muted">{{ product.brand ?? product.categoryName }}</p>
      <component
        :is="`h${headingLevel ?? 2}`"
        class="line-clamp-2 text-sm font-semibold text-text sm:text-base"
      >
        <NuxtLink
          :to="`/produtos/${product.slug}`"
          class="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-focus"
        >
          {{ product.name }}
        </NuxtLink>
      </component>
      <p
        class="mt-auto pt-2 text-lg font-extrabold tabular-nums"
        :class="product.available ? 'text-text' : 'text-text-muted'"
      >
        {{ formatMoney(product.priceCents) }}
      </p>
      <p v-if="product.available && product.lowStock" class="text-xs font-medium text-on-warning-soft">
        Últimas unidades
      </p>
    </div>
  </article>
</template>
