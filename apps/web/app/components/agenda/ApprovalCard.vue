<script setup lang="ts">
import { BadgeCheck, Undo2 } from 'lucide-vue-next';
import { appliance, formatTimeRange, storeDay, formatLongDay } from '~/utils/agenda';
import { formatDateTime } from '~/utils/masks';

/** UC Aprovar Finalização: approve the report with the value of the service, or send it back with a comment. */
const props = withDefaults(defineProps<{ appointment: Appointment; headingLevel?: 2 | 3 }>(), {
  headingLevel: 2,
});
const emit = defineEmits<{ decided: [appointment: Appointment] }>();

const api = useApi();
const toast = useToast();

const amount = ref<number | string>(0);
const amountError = ref('');
const comment = ref('');
const commentError = ref('');
const reworking = ref(false);
const acting = ref(false);

const report = computed(() => props.appointment.report!);
const params = () => ({ path: { id: props.appointment.id } });
const titleId = `approval-${props.appointment.id}`;

async function run(action: () => Promise<Appointment>, done: string): Promise<void> {
  acting.value = true;
  try {
    const updated = await action();
    toast.success({ title: done });
    emit('decided', updated);
  } catch (error) {
    toast.error({ title: toApiError(error).message });
  } finally {
    acting.value = false;
  }
}

async function approve(): Promise<void> {
  const amountCents = Number(amount.value);
  amountError.value = amountCents > 0 ? '' : 'Informe o valor cobrado pelo serviço.';
  if (amountError.value) return;
  await run(
    () =>
      unwrap(
        api.POST('/api/v1/appointments/{id}/report/approval', { params: params(), body: { amountCents } }),
      ),
    'Serviço aprovado e concluído.',
  );
}

async function sendBack(): Promise<void> {
  const text = comment.value.trim();
  commentError.value = text.length >= 5 ? '' : 'Explique o ajuste, com pelo menos 5 letras.';
  if (commentError.value) return;
  await run(
    () =>
      unwrap(
        api.POST('/api/v1/appointments/{id}/report/rework', { params: params(), body: { comment: text } }),
      ),
    'Relatório devolvido ao técnico.',
  );
}
</script>

<template>
  <article
    class="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 md:p-5"
    :aria-labelledby="titleId"
    data-testid="approval-card"
  >
    <header class="flex flex-wrap items-start justify-between gap-2">
      <div class="min-w-0">
        <component :is="`h${headingLevel}`" :id="titleId" class="text-lg font-extrabold text-text">
          {{ appointment.request.serviceType }}: {{ appointment.request.customer.name }}
        </component>
        <p class="text-sm text-text-muted first-letter:uppercase">
          {{ formatLongDay(storeDay(appointment.startsAt)) }},
          {{ formatTimeRange(appointment.startsAt, appointment.endsAt) }} · {{ appointment.employee.name }}
        </p>
      </div>
      <NuxtLink :to="`/agenda/${appointment.id}`" class="min-h-11 text-sm font-semibold text-link">
        Ver atendimento
      </NuxtLink>
    </header>

    <dl class="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt class="font-semibold text-text-muted">Aparelho</dt>
        <dd class="text-text">{{ appliance(appointment.request) }}</dd>
      </div>
      <div>
        <dt class="font-semibold text-text-muted">Enviado em</dt>
        <dd class="text-text">{{ formatDateTime(report.submittedAt) }}</dd>
      </div>
      <div>
        <dt class="font-semibold text-text-muted">Defeito encontrado</dt>
        <dd class="whitespace-pre-line text-text">
          {{ report.defectFound ? report.defectDescription : 'Não' }}
        </dd>
      </div>
      <div>
        <dt class="font-semibold text-text-muted">Reparo realizado</dt>
        <dd class="whitespace-pre-line text-text" data-testid="approval-repair">
          {{ report.repairDescription }}
        </dd>
      </div>
    </dl>

    <ServicePhotos :photos="report.photos" subject="do serviço" />

    <div class="flex flex-col gap-3 border-t border-border pt-4">
      <template v-if="!reworking">
        <BaseMaskedField
          v-model="amount"
          mask="money"
          label="Valor do serviço"
          :error="amountError"
          required
        />
        <div class="flex flex-wrap gap-2">
          <BaseButton :loading="acting" @click="approve">
            <BadgeCheck class="size-5" aria-hidden="true" />
            Aprovar
          </BaseButton>
          <BaseButton variant="secondary" @click="reworking = true">
            <Undo2 class="size-5" aria-hidden="true" />
            Devolver para ajuste
          </BaseButton>
        </div>
      </template>
      <template v-else>
        <BaseTextArea
          v-model="comment"
          label="O que o técnico precisa ajustar"
          :maxlength="1000"
          :rows="3"
          :error="commentError"
          required
        />
        <div class="flex flex-wrap gap-2">
          <BaseButton :loading="acting" @click="sendBack">Enviar para o técnico</BaseButton>
          <BaseButton variant="ghost" @click="reworking = false">Voltar</BaseButton>
        </div>
      </template>
    </div>
  </article>
</template>
