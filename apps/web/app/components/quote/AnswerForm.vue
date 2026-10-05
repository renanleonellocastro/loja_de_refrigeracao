<script setup lang="ts">
import { Send } from 'lucide-vue-next';
import { DEFAULT_VALIDITY_DAYS, MAX_VALIDITY_DAYS, MIN_VALIDITY_DAYS, type Quote } from '~/utils/quotes';

/**
 * UC Responder Orçamento: the value (typed in cents from the right, like a card machine), the validity in days
 * counted in São Paulo, what is included and notes. Sending moves the quote to "Respondido" and emails the
 * customer.
 */
const props = defineProps<{ quoteId: number }>();
const emit = defineEmits<{ answered: [quote: Quote] }>();

const api = useApi();

interface Values extends Record<string, unknown> {
  amountCents: number;
  validityDays: string;
  included: string;
  notes: string;
}

const form = useForm<Values>(
  { amountCents: 0, validityDays: String(DEFAULT_VALIDITY_DAYS), included: '', notes: '' },
  {
    inline: true,
    validate: (values) => {
      const errors: FieldErrors = {};
      if (values.amountCents <= 0) errors.amountCents = 'Informe o valor do orçamento.';
      const days = Number(values.validityDays);
      if (!Number.isInteger(days) || days < MIN_VALIDITY_DAYS || days > MAX_VALIDITY_DAYS) {
        errors.validityDays = `A validade vai de ${MIN_VALIDITY_DAYS} a ${MAX_VALIDITY_DAYS} dias.`;
      }
      if (values.included.trim().length < 3) errors.included = 'Diga o que está incluído no valor.';
      return errors;
    },
  },
);

async function send(): Promise<void> {
  await form.submit(async (values) => {
    const notes = values.notes.trim();
    const quote = await unwrap(
      api.POST('/api/v1/quotes/{id}/answer', {
        params: { path: { id: props.quoteId } },
        body: {
          amountCents: values.amountCents,
          validityDays: Number(values.validityDays),
          included: values.included.trim(),
          notes: notes || undefined,
        },
      }),
    );
    emit('answered', quote);
  });
}
</script>

<template>
  <BaseCard title="Responder orçamento" :heading-level="3">
    <form class="flex flex-col gap-5" novalidate @submit.prevent="send">
      <div class="grid gap-4 sm:grid-cols-2">
        <BaseMaskedField
          v-model="form.values.amountCents"
          mask="money"
          label="Valor"
          :error="form.error('amountCents')"
          required
        />
        <BaseTextField
          v-model="form.values.validityDays"
          label="Validade em dias"
          inputmode="numeric"
          :hint="`De ${MIN_VALIDITY_DAYS} a ${MAX_VALIDITY_DAYS} dias, contados a partir de hoje.`"
          :error="form.error('validityDays')"
          required
        />
      </div>
      <BaseTextArea
        v-model="form.values.included"
        label="O que está incluído"
        placeholder="Mão de obra, peças, gás, garantia de 90 dias…"
        :maxlength="2000"
        :rows="4"
        :error="form.error('included')"
        required
      />
      <BaseTextArea
        v-model="form.values.notes"
        label="Observações"
        hint="Opcional. Forma de pagamento, prazo, o que o cliente precisa deixar pronto."
        :maxlength="2000"
        :rows="3"
        :error="form.error('notes')"
      />
      <BaseAlert v-if="form.message.value" tone="danger">{{ form.message.value }}</BaseAlert>
      <BaseButton type="submit" class="self-end" :loading="form.pending.value">
        <Send class="size-5" aria-hidden="true" />
        Enviar orçamento
      </BaseButton>
    </form>
  </BaseCard>
</template>
