<script setup lang="ts">
import { can } from '@rc/contracts';
import { CircleCheck, Send } from 'lucide-vue-next';
import { MAX_QUOTE_PHOTOS, type Quote } from '~/utils/quotes';
import { serviceIllustration } from '~/utils/service-requests';

/**
 * UC Solicitar Orçamento: service type, description and optional photos. The quote goes with an
 * Idempotency-Key, so a retry after a dropped connection cannot create two; the photos follow in a multipart
 * upload. Managers and the super user pick the customer and ask on their behalf.
 */
definePageMeta({ layout: 'area', permission: 'quotes.create', title: 'Pedir orçamento' });
useHead({ title: 'Pedir orçamento | Refrigeração Castro' });

const api = useApi();
const auth = useAuthStore();
const route = useRoute();
const config = useRuntimeConfig();

const staff = computed(() => can(auth.actor, 'quotes.answer'));

const types = ref<ServiceType[] | null>(null);
const typesFailed = ref(false);
const customer = ref<PickedCustomer | null>(null);
const photos = ref<File[]>([]);
const created = ref<Quote | null>(null);
const uploadProgress = ref<number | null>(null);
const photoWarning = ref('');
let idempotencyKey = crypto.randomUUID();

interface Values extends Record<string, unknown> {
  customerId: number;
  serviceTypeId: string;
  description: string;
}

const form = useForm<Values>(
  {
    customerId: 0,
    serviceTypeId: typeof route.query.servico === 'string' ? route.query.servico : '',
    description: '',
  },
  { inline: true, validate },
);

watch(customer, (picked) => (form.values.customerId = picked?.id ?? 0));

function validate(values: Values): FieldErrors {
  const errors: FieldErrors = {};
  if (staff.value && !values.customerId) errors.customerId = 'Escolha o cliente.';
  if (!values.serviceTypeId) errors.serviceTypeId = 'Escolha o serviço.';
  if (values.description.trim().length < 10) {
    errors.description = 'Conte um pouco mais sobre o serviço, com pelo menos 10 letras.';
  }
  return errors;
}

async function loadTypes(): Promise<void> {
  typesFailed.value = false;
  try {
    types.value = (await unwrap(api.GET('/api/v1/service-types'))).filter((type) => type.active);
  } catch {
    typesFailed.value = true;
  }
}

async function uploadPhotos(id: number): Promise<void> {
  const body = new FormData();
  for (const file of photos.value) body.append('files', file, file.name);
  uploadProgress.value = 0;
  try {
    const result = await uploadWithProgress(
      `${config.public.apiBase}/api/v1/quotes/${id}/photos`,
      body,
      auth.accessToken,
      (percent) => (uploadProgress.value = percent),
    );
    if (result.status !== 201) throw problemToError(result.status, result.body);
  } catch {
    photoWarning.value =
      'Seu pedido de orçamento foi registrado, mas as fotos não chegaram. Mande pela conversa do orçamento se precisar.';
  } finally {
    uploadProgress.value = null;
  }
}

async function send(): Promise<void> {
  const ok = await form.submit(async (values) => {
    const result = await api.POST('/api/v1/quotes', {
      body: {
        customerId: staff.value ? values.customerId : undefined,
        serviceTypeId: Number(values.serviceTypeId),
        description: values.description.trim(),
      },
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    // The API answered: the next attempt is a new quote.
    idempotencyKey = crypto.randomUUID();
    if (!result.data) throw problemToError(result.response.status, result.error);
    created.value = result.data;
  });
  if (ok && photos.value.length > 0) await uploadPhotos(created.value!.id);
}

function startOver(): void {
  created.value = null;
  photos.value = [];
  photoWarning.value = '';
  customer.value = null;
  form.reset({ customerId: 0, serviceTypeId: '', description: '' });
}

const detailLink = computed(() =>
  staff.value ? `/orcamentos/${created.value!.id}` : `/minha-conta/orcamentos/${created.value!.id}`,
);

onMounted(loadTypes);
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <div v-if="created" class="flex flex-col items-center gap-4 py-6 text-center" data-testid="quote-success">
      <span
        class="flex size-16 items-center justify-center rounded-full bg-success-soft text-on-success-soft"
      >
        <CircleCheck class="size-9" aria-hidden="true" />
      </span>
      <h2 class="text-2xl font-extrabold text-text">Pronto! Pedido de orçamento enviado.</h2>
      <p class="max-w-md text-text-muted">
        A loja responde em até 1 dia útil, por email e aqui no site. O número do orçamento é
        <strong class="text-text tabular-nums" data-testid="quote-number">{{ created.id }}</strong
        >.
      </p>
      <BaseProgressBar
        v-if="uploadProgress !== null"
        class="w-full max-w-sm"
        label="Enviando fotos"
        :value="uploadProgress"
        show-value
      />
      <BaseAlert v-if="photoWarning" tone="warning" class="text-left">{{ photoWarning }}</BaseAlert>
      <div class="flex flex-wrap justify-center gap-2">
        <BaseButton :to="detailLink" :disabled="uploadProgress !== null">Ver orçamento</BaseButton>
        <BaseButton variant="secondary" @click="startOver">Pedir outro orçamento</BaseButton>
      </div>
    </div>

    <form v-else class="flex flex-col gap-5" novalidate @submit.prevent="send">
      <p class="text-text-muted">
        Conte o que você precisa e a loja manda o valor, a validade e o que está incluído. Sem compromisso.
      </p>

      <BaseCard v-if="staff" title="Cliente" :heading-level="2">
        <div class="flex flex-col gap-2">
          <CounterCustomerPicker v-model="customer" />
          <p v-if="form.error('customerId')" class="text-sm font-medium text-danger" role="alert">
            {{ form.error('customerId') }}
          </p>
        </div>
      </BaseCard>

      <BaseCard title="Tipo de serviço" :heading-level="2">
        <ErrorState v-if="typesFailed" kind="server" :heading-level="3" @retry="loadTypes" />
        <div v-else-if="!types" class="grid gap-3 sm:grid-cols-2" role="status">
          <span class="sr-only">Carregando serviços…</span>
          <BaseSkeleton v-for="n in 4" :key="n" class="h-24 w-full rounded-lg" />
        </div>
        <fieldset v-else>
          <legend class="sr-only">Tipo de serviço</legend>
          <div class="grid gap-3 sm:grid-cols-2">
            <label
              v-for="type in types"
              :key="type.id"
              class="flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus"
              :class="
                form.values.serviceTypeId === String(type.id)
                  ? 'border-primary bg-info-soft'
                  : 'border-border bg-surface hover:border-primary/60'
              "
            >
              <input
                v-model="form.values.serviceTypeId"
                type="radio"
                name="serviceTypeId"
                :value="String(type.id)"
                class="sr-only"
                :aria-invalid="form.error('serviceTypeId') ? 'true' : undefined"
              />
              <img
                :src="serviceIllustration(type.name)"
                alt=""
                width="64"
                height="64"
                class="size-14 shrink-0 sm:size-16"
              />
              <span class="min-w-0">
                <span class="block font-semibold text-text">{{ type.name }}</span>
                <span class="block text-sm text-text-muted">{{ type.description }}</span>
              </span>
            </label>
          </div>
        </fieldset>
        <p v-if="form.error('serviceTypeId')" class="mt-3 text-sm font-medium text-danger" role="alert">
          {{ form.error('serviceTypeId') }}
        </p>
      </BaseCard>

      <BaseCard title="O que você precisa?" :heading-level="2">
        <div class="flex flex-col gap-5">
          <BaseTextArea
            v-model="form.values.description"
            label="Descrição"
            placeholder="Qual é o aparelho, o que está acontecendo, o que você quer fazer…"
            :maxlength="2000"
            :rows="5"
            :error="form.error('description')"
            required
          />
          <BasePhotoUpload
            v-model="photos"
            label="Fotos (opcional)"
            hint="Foto do aparelho, da etiqueta e do local ajudam a calcular o valor."
            :max="MAX_QUOTE_PHOTOS"
          />
        </div>
      </BaseCard>

      <BaseAlert v-if="form.message.value" tone="danger">{{ form.message.value }}</BaseAlert>
      <BaseButton type="submit" class="self-end" :loading="form.pending.value">
        <Send class="size-5" aria-hidden="true" />
        Pedir orçamento
      </BaseButton>
    </form>
  </div>
</template>
