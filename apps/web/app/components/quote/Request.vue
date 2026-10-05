<script setup lang="ts">
import type { Quote } from '~/utils/quotes';

/** What the customer asked for: the service type, the description and the photos. */
defineProps<{ quote: Quote }>();
</script>

<template>
  <BaseCard title="Pedido" :heading-level="3">
    <p class="text-sm font-semibold text-text-muted">{{ quote.serviceType.name }}</p>
    <p class="mt-2 whitespace-pre-line text-text" data-testid="quote-description">{{ quote.description }}</p>
    <div class="mt-4">
      <ServicePhotos :photos="quote.photos" subject="do pedido" />
    </div>
  </BaseCard>
</template>
