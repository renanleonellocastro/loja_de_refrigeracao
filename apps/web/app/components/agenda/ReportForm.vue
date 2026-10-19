<script setup lang="ts">
import { CheckCheck } from 'lucide-vue-next';
import { MAX_REPORT_PHOTOS, clearDraft, loadDraft, saveDraft, type ReportDraft } from '~/utils/agenda';
import { usePhotoUpload } from '~/helpers/photo-upload';

/**
 * UC Finalizar Serviço: defect found or not, what was repaired and photos of the work. The text is kept on
 * the device while typing, so a dropped connection loses nothing; sending again after a rework request
 * replaces the report.
 */
const props = defineProps<{ appointment: Appointment }>();
const emit = defineEmits<{ done: [appointment: Appointment] }>();

const api = useApi();
const toast = useToast();
const { progress: uploadProgress, send: sendPhotos } = usePhotoUpload();

function initial(): ReportDraft {
  const draft = loadDraft(props.appointment.id);
  if (draft) return draft;
  const report = props.appointment.report;
  if (!report) return { defectFound: '', defectDescription: '', repairDescription: '' };
  return {
    defectFound: report.defectFound ? 'sim' : 'nao',
    defectDescription: report.defectDescription ?? '',
    repairDescription: report.repairDescription,
  };
}

const restored = loadDraft(props.appointment.id) !== null;
const form = useForm(initial(), {
  inline: true,
  validate: (values) => {
    const errors: FieldErrors = {};
    if (!values.defectFound) errors.defectFound = 'Diga se encontrou defeito.';
    if (values.defectFound === 'sim' && values.defectDescription.trim().length < 5)
      errors.defectDescription = 'Descreva o defeito, com pelo menos 5 letras.';
    if (values.repairDescription.trim().length < 5)
      errors.repairDescription = 'Conte o que foi feito, com pelo menos 5 letras.';
    return errors;
  },
});

const photos = ref<File[]>([]);
const offline = ref(false);
const existingPhotos = computed(() => props.appointment.report?.photos.length ?? 0);
const photoLimit = computed(() => Math.max(0, MAX_REPORT_PHOTOS - existingPhotos.value));

watch(
  () => ({ ...form.values }),
  (values) => saveDraft(props.appointment.id, values),
  { deep: true },
);

const DEFECT_OPTIONS = [
  { value: 'sim', label: 'Sim, encontrei defeito' },
  { value: 'nao', label: 'Não encontrei defeito' },
] as const;

async function uploadPhotos(): Promise<Appointment | null> {
  try {
    const path = `/api/v1/appointments/${props.appointment.id}/report/photos`;
    const updated = await sendPhotos<Appointment>(path, photos.value);
    photos.value = [];
    return updated;
  } catch (error) {
    toast.error({
      title: 'O relatório foi enviado, mas as fotos não chegaram.',
      description: toApiError(error).message,
    });
    return null;
  }
}

function reportBody(values: ReportDraft) {
  const defectFound = values.defectFound === 'sim';
  return {
    defectFound,
    defectDescription: defectFound ? values.defectDescription.trim() : undefined,
    repairDescription: values.repairDescription.trim(),
  };
}

/** Posts the report; a dropped connection shows the warning that the draft stays on the device. */
async function postReport(values: ReportDraft): Promise<Appointment> {
  try {
    const params = { path: { id: props.appointment.id } };
    return await unwrap(api.POST('/api/v1/appointments/{id}/report', { params, body: reportBody(values) }));
  } catch (error) {
    offline.value = toApiError(error).status === 0;
    throw error;
  }
}

async function submitReport(): Promise<Appointment | undefined> {
  const outcome: { report?: Appointment } = {};
  const ok = await form.submit(async (values) => {
    outcome.report = await postReport(values);
  });
  return ok ? outcome.report : undefined;
}

async function send(): Promise<void> {
  offline.value = false;
  const report = await submitReport();
  if (!report) return;
  clearDraft(props.appointment.id);
  const withPhotos = photos.value.length > 0 ? await uploadPhotos() : null;
  toast.success({ title: 'Serviço finalizado. A gerência vai conferir o relatório.' });
  emit('done', withPhotos ?? report);
}
</script>

<template>
  <form class="flex flex-col gap-5" novalidate @submit.prevent="send">
    <BaseAlert v-if="offline" tone="warning" title="Sem conexão" data-testid="report-offline">
      Guardamos o que você escreveu neste aparelho. Quando a internet voltar, toque em Finalizar serviço de
      novo. As fotos precisam ser escolhidas outra vez se a página for fechada.
    </BaseAlert>
    <BaseAlert v-else-if="form.message.value" tone="danger" title="Não deu para finalizar">
      {{ form.message.value }}
    </BaseAlert>
    <p v-if="restored" class="text-sm text-text-muted" data-testid="report-draft">
      Recuperamos o rascunho guardado neste aparelho.
    </p>

    <fieldset
      class="flex flex-col gap-2"
      :aria-invalid="form.error('defectFound') ? 'true' : undefined"
      aria-describedby="defect-error"
    >
      <legend class="mb-2 text-sm font-semibold text-text">
        Encontrou defeito? <span class="text-danger" aria-hidden="true">*</span>
      </legend>
      <div class="grid gap-2 sm:grid-cols-2">
        <label
          v-for="option in DEFECT_OPTIONS"
          :key="option.value"
          class="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-border-strong px-4 font-semibold text-text has-[:checked]:border-primary has-[:checked]:bg-info-soft"
        >
          <input
            v-model="form.values.defectFound"
            type="radio"
            name="defectFound"
            :value="option.value"
            class="size-5 accent-[var(--color-primary)]"
          />
          {{ option.label }}
        </label>
      </div>
      <p v-if="form.error('defectFound')" id="defect-error" class="text-sm font-semibold text-danger">
        {{ form.error('defectFound') }}
      </p>
    </fieldset>

    <BaseTextArea
      v-if="form.values.defectFound === 'sim'"
      v-model="form.values.defectDescription"
      label="Descrição do defeito"
      :maxlength="2000"
      :rows="3"
      :error="form.error('defectDescription')"
      required
    />
    <BaseTextArea
      v-model="form.values.repairDescription"
      label="Reparo realizado"
      hint="O que foi trocado, ajustado ou orientado ao cliente."
      :maxlength="2000"
      :rows="4"
      :error="form.error('repairDescription')"
      required
    />
    <BasePhotoUpload
      v-if="photoLimit > 0"
      v-model="photos"
      label="Fotos do serviço"
      prompt="Mostre o serviço feito com fotos."
      hint="Tire fotos do aparelho e das peças trocadas."
      :max="photoLimit"
    />
    <BaseProgressBar v-if="uploadProgress !== null" :value="uploadProgress" label="Enviando fotos" />

    <BaseButton type="submit" size="lg" block :loading="form.pending.value || uploadProgress !== null">
      <CheckCheck class="size-5" aria-hidden="true" />
      Finalizar serviço
    </BaseButton>
  </form>
</template>
