<script setup lang="ts">
import { CircleCheck } from 'lucide-vue-next';

/** Confirmation after the staff placed an order for a customer: number, customer, items and the next steps. */
defineProps<{ order: Order; title: string }>();
</script>

<template>
  <div class="mx-auto flex max-w-xl flex-col gap-5" data-testid="order-placed">
    <div class="flex flex-col items-center gap-3 text-center">
      <span
        class="flex size-16 items-center justify-center rounded-full bg-success-soft text-on-success-soft"
      >
        <CircleCheck class="size-9" aria-hidden="true" />
      </span>
      <h2 class="text-2xl font-extrabold text-text">{{ title }}</h2>
      <p class="text-text-muted">
        Pedido
        <strong class="text-text tabular-nums" data-testid="sale-number">{{ order.number }}</strong> para
        {{ order.customer.name }}. <slot />
      </p>
    </div>
    <BaseCard title="Resumo" :heading-level="3">
      <OrderItems :order="order" />
    </BaseCard>
    <div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
      <slot name="actions" />
    </div>
  </div>
</template>
