<script setup lang="ts">
import { CalendarClock } from 'lucide-vue-next';
import { formatDateTime, formatMoney } from '~/utils/masks';
import { formatValidUntil, type Quote } from '~/utils/quotes';

/** The answer of the store: the value in reais, the last day to accept, what is included and the notes. */
defineProps<{ quote: Quote }>();
</script>

<template>
  <BaseCard title="Orçamento" :heading-level="3">
    <div class="flex flex-col gap-4" data-testid="quote-offer">
      <div>
        <p class="text-sm font-semibold text-text-muted">Valor</p>
        <p class="text-3xl font-extrabold text-text tabular-nums" data-testid="quote-amount">
          {{ formatMoney(quote.amountCents!) }}
        </p>
      </div>
      <p class="flex items-start gap-2 text-text">
        <CalendarClock class="mt-0.5 size-5 shrink-0 text-text-muted" aria-hidden="true" />
        <span>
          Válido até <strong>{{ formatValidUntil(quote.validUntil!) }}</strong>
        </span>
      </p>
      <div>
        <p class="text-sm font-semibold text-text-muted">O que está incluído</p>
        <p class="mt-1 whitespace-pre-line text-text">{{ quote.included }}</p>
      </div>
      <div v-if="quote.notes">
        <p class="text-sm font-semibold text-text-muted">Observações</p>
        <p class="mt-1 whitespace-pre-line text-text">{{ quote.notes }}</p>
      </div>
      <p v-if="quote.answeredBy" class="text-sm text-text-muted">
        Respondido por {{ quote.answeredBy.name }} em {{ formatDateTime(quote.answeredAt!) }}
      </p>
    </div>
  </BaseCard>
</template>
