<script setup lang="ts">
import { countLabel } from '~/utils/catalog';

/** Item count of the cart on top of its icon in the area navigation. Hidden while the cart is empty. */
const cart = useCartStore();
</script>

<template>
  <span
    v-if="cart.count > 0"
    class="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[0.625rem] font-bold text-on-danger tabular-nums ring-2 ring-surface-raised"
    data-testid="cart-badge"
  >
    <span aria-hidden="true">{{ cart.count > 99 ? '99+' : cart.count }}</span>
    <span class="sr-only">, {{ countLabel(cart.count, 'item', 'itens') }}</span>
  </span>
</template>
