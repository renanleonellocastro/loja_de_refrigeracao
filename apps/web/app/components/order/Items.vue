<script setup lang="ts">
import { formatMoney } from '~/utils/masks';

/** Items and total of an order, as frozen when it was placed. */
defineProps<{ order: Order }>();
</script>

<template>
  <div>
    <ul class="divide-y divide-border">
      <li
        v-for="item in order.items"
        :key="item.productId"
        class="flex items-start justify-between gap-3 py-3"
      >
        <div class="min-w-0">
          <p class="font-semibold text-text">{{ item.productName }}</p>
          <p class="text-sm text-text-muted tabular-nums">
            {{ item.quantity }} × {{ formatMoney(item.unitPriceCents) }}
          </p>
        </div>
        <p class="font-semibold text-text tabular-nums">{{ formatMoney(item.subtotalCents) }}</p>
      </li>
    </ul>
    <div class="flex items-baseline justify-between border-t border-border pt-3">
      <p class="font-semibold text-text">Total</p>
      <p class="text-xl font-extrabold text-text tabular-nums">{{ formatMoney(order.totalCents) }}</p>
    </div>
  </div>
</template>
