<script setup lang="ts">
import { CalendarDays, MapPin } from 'lucide-vue-next';
import { formatAddress } from '~/utils/address';
import { formatWindow, sortWindows } from '~/utils/service-requests';

/** What the customer asked: the appliance, the problem, the photos, the days that suit and the address. */
const props = defineProps<{ request: ServiceRequest }>();

const appliance = computed(() =>
  [props.request.productKind, props.request.brand, props.request.model].filter(Boolean).join(' · '),
);
</script>

<template>
  <div class="flex flex-col gap-5">
    <BaseCard title="Problema" :heading-level="3">
      <p class="text-sm font-semibold text-text-muted">{{ request.serviceType.name }} · {{ appliance }}</p>
      <p class="mt-2 whitespace-pre-line text-text" data-testid="request-problem">{{ request.problem }}</p>
      <div class="mt-4">
        <ServicePhotos :photos="request.photos" />
      </div>
    </BaseCard>
    <BaseCard title="Dias que ficam bons" :heading-level="3">
      <ul class="flex flex-col gap-2">
        <li
          v-for="window in sortWindows(request.windows)"
          :key="`${window.day}-${window.period}`"
          class="flex items-start gap-2 text-text"
        >
          <CalendarDays class="mt-0.5 size-4.5 shrink-0 text-text-muted" aria-hidden="true" />
          {{ formatWindow(window) }}
        </li>
      </ul>
      <p class="mt-4 flex items-start gap-2 text-text">
        <MapPin class="mt-0.5 size-4.5 shrink-0 text-text-muted" aria-hidden="true" />
        <span>{{ formatAddress(request.address) }}</span>
      </p>
    </BaseCard>
  </div>
</template>
