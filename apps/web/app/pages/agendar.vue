<script setup lang="ts">
import { can } from '@rc/contracts';
import { ArrowLeft, ArrowRight, CircleCheck, Send } from 'lucide-vue-next';
import {
  addressToApi,
  emptyAddress,
  formatAddress,
  validateAddress,
  type AddressForm,
  type ApiAddress,
} from '~/utils/address';
import {
  formatWindow,
  MAX_REQUEST_PHOTOS,
  serviceIllustration,
  type VisitWindow,
} from '~/utils/service-requests';
import { usePhotoUpload } from '~/composables/usePhotoUpload';

/**
 * UC Solicitar Agendamento de Reparo/Manutenção (RF-31): a step by step form. The request goes with an
 * Idempotency-Key, so a retry after a dropped connection cannot create two; the photos follow in a multipart
 * upload. Managers and the super user pick the customer and request on their behalf.
 */
definePageMeta({ layout: 'area', permission: 'serviceRequests.create', title: 'Agendar visita' });
useHead({ title: 'Agendar visita | Refrigeração Castro' });

type StepKey = 'cliente' | 'servico' | 'aparelho' | 'problema' | 'datas' | 'endereco' | 'revisao';

const STEP_LABELS: Record<StepKey, string> = {
  cliente: 'Cliente',
  servico: 'Serviço',
  aparelho: 'Aparelho',
  problema: 'Problema',
  datas: 'Datas',
  endereco: 'Endereço',
  revisao: 'Revisão',
};

const ADDRESS_OPTIONS = ['profile', 'other'] as const;

const MIN_PRODUCT_KIND_LENGTH = 2;
const MIN_PROBLEM_LENGTH = 10;
const PHOTO_WARNING =
  'Sua solicitação foi registrada, mas as fotos não chegaram. Mande pela conversa do agendamento se precisar.';

/** Step of each top level field, to bring the person back to the field the API refused. */
const FIELD_STEPS: Record<string, StepKey> = {
  customerId: 'cliente',
  serviceTypeId: 'servico',
  productKind: 'aparelho',
  brand: 'aparelho',
  model: 'aparelho',
  problem: 'problema',
  windows: 'datas',
  addressMode: 'endereco',
  address: 'endereco',
};

const api = useApi();
const auth = useAuthStore();
const route = useRoute();
const { progress: uploadProgress, send: sendPhotos } = usePhotoUpload();

const staff = computed(() => can(auth.actor, 'serviceRequests.manage'));
const steps = computed<StepKey[]>(() => [
  ...(staff.value ? (['cliente'] as const) : []),
  'servico',
  'aparelho',
  'problema',
  'datas',
  'endereco',
  'revisao',
]);
const current = ref(0);
const step = computed(() => steps.value[current.value]!);
const heading = useTemplateRef<HTMLElement>('heading');

const types = ref<ServiceType[] | null>(null);
const typesFailed = ref(false);
const profileAddress = ref<ApiAddress | null>(null);
const customer = ref<PickedCustomer | null>(null);
const photos = ref<File[]>([]);
const created = ref<ServiceRequest | null>(null);
const photoWarning = ref('');
let idempotencyKey = crypto.randomUUID();

interface Values extends Record<string, unknown> {
  customerId: number;
  serviceTypeId: string;
  productKind: string;
  brand: string;
  model: string;
  problem: string;
  windows: VisitWindow[];
  addressMode: 'profile' | 'other';
  address: AddressForm;
}

type RequestFields = Pick<
  Values,
  'serviceTypeId' | 'productKind' | 'brand' | 'model' | 'problem' | 'windows'
>;

/** The fields of one request, blank: a new request after a sent one starts from these. */
function blankRequestFields(): RequestFields {
  return { serviceTypeId: '', productKind: '', brand: '', model: '', problem: '', windows: [] };
}

const form = useForm<Values>(
  {
    customerId: 0,
    ...blankRequestFields(),
    serviceTypeId: typeof route.query.servico === 'string' ? route.query.servico : '',
    addressMode: 'profile',
    address: emptyAddress(),
  },
  { inline: true, validate: (values) => validateAll(values) },
);

watch(customer, (picked) => (form.values.customerId = picked?.id ?? 0));

const selectedType = computed(() =>
  types.value?.find((type) => String(type.id) === form.values.serviceTypeId),
);
/** The customer has no address on file: the visit needs one typed here. */
const needsAddress = computed(() => !staff.value && !profileAddress.value);

/** The visit goes to an address typed here instead of the one on file. */
function usesOtherAddress(values: Values): boolean {
  return values.addressMode === 'other' || needsAddress.value;
}

/** The message of a field when its check fails, no error otherwise. */
function errorWhen(isInvalid: boolean, field: string, message: string): FieldErrors {
  return isInvalid ? { [field]: message } : {};
}

/** Field errors of one step: only the step on screen is checked before moving on. */
const STEP_VALIDATORS: Record<StepKey, (values: Values) => FieldErrors> = {
  cliente: (values) => errorWhen(!values.customerId, 'customerId', 'Escolha o cliente.'),
  servico: (values) => errorWhen(!values.serviceTypeId, 'serviceTypeId', 'Escolha o serviço.'),
  aparelho: (values) =>
    errorWhen(
      values.productKind.trim().length < MIN_PRODUCT_KIND_LENGTH,
      'productKind',
      'Diga qual é o aparelho, como geladeira duplex.',
    ),
  problema: (values) =>
    errorWhen(
      values.problem.trim().length < MIN_PROBLEM_LENGTH,
      'problem',
      'Conte um pouco mais sobre o problema, com pelo menos 10 letras.',
    ),
  datas: (values) =>
    errorWhen(values.windows.length === 0, 'windows', 'Escolha pelo menos um dia e período.'),
  endereco: (values) => (usesOtherAddress(values) ? validateAddress(values.address, true) : {}),
  revisao: () => ({}),
};

function validateStep(key: StepKey, values: Values): FieldErrors {
  return STEP_VALIDATORS[key](values);
}

function validateAll(values: Values): FieldErrors {
  return Object.assign({}, ...steps.value.map((key) => validateStep(key, values)));
}

function stepOf(path: string): StepKey {
  return FIELD_STEPS[path.split('.')[0]!]!;
}

async function goTo(index: number): Promise<void> {
  current.value = index;
  await nextTick();
  heading.value?.focus();
}

async function next(): Promise<void> {
  const errors = validateStep(step.value, form.values);
  form.errors.value = errors;
  if (Object.keys(errors).length > 0) {
    await nextTick();
    document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    return;
  }
  await goTo(current.value + 1);
}

async function loadTypes(): Promise<void> {
  typesFailed.value = false;
  try {
    types.value = (await unwrap(api.GET('/api/v1/service-types'))).filter((type) => type.active);
  } catch {
    typesFailed.value = true;
  }
}

async function loadProfile(): Promise<void> {
  if (staff.value) return;
  try {
    profileAddress.value = (await unwrap(api.GET('/api/v1/me'))).address;
  } catch {
    // Without the profile the person types the address; the request itself still works.
    profileAddress.value = null;
  }
}

async function uploadPhotos(id: number): Promise<void> {
  try {
    await sendPhotos(`/api/v1/service-requests/${id}/photos`, photos.value);
  } catch {
    photoWarning.value = PHOTO_WARNING;
  }
}

function requestBody(values: Values) {
  return {
    customerId: staff.value ? values.customerId : undefined,
    serviceTypeId: Number(values.serviceTypeId),
    productKind: values.productKind.trim(),
    brand: values.brand.trim() || undefined,
    model: values.model.trim() || undefined,
    problem: values.problem.trim(),
    windows: values.windows,
    address: usesOtherAddress(values) ? addressToApi(values.address)! : undefined,
  };
}

async function createRequest(values: Values): Promise<void> {
  const result = await api.POST('/api/v1/service-requests', {
    body: requestBody(values),
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  // The API answered: the next attempt is a new request.
  idempotencyKey = crypto.randomUUID();
  if (!result.data) throw problemToError(result.response.status, result.error);
  created.value = result.data;
}

/** Brings the person back to the step of the first field the API refused. */
async function returnToRefusedStep(): Promise<void> {
  const first = Object.keys(form.errors.value)[0];
  if (first) await goTo(steps.value.indexOf(stepOf(first)));
}

async function send(): Promise<void> {
  const ok = await form.submit(createRequest);
  if (!ok) return returnToRefusedStep();
  if (photos.value.length > 0) await uploadPhotos(created.value!.id);
}

function startOver(): void {
  created.value = null;
  photos.value = [];
  photoWarning.value = '';
  customer.value = null;
  form.reset({ ...form.values, ...blankRequestFields() });
  current.value = 0;
}

const detailLink = computed(() =>
  staff.value ? `/solicitacoes/${created.value!.id}` : `/minha-conta/agendamentos/${created.value!.id}`,
);

function applianceDetail(values: Values): string {
  return [values.productKind, values.brand, values.model].filter(Boolean).join(' · ');
}

function photosDetail(count: number): string {
  return count ? `${count} de ${MAX_REQUEST_PHOTOS}` : 'Nenhuma';
}

function addressDetail(values: Values): string {
  if (usesOtherAddress(values)) return formatAddress(addressToApi(values.address));
  return staff.value ? 'Endereço do cadastro do cliente' : formatAddress(profileAddress.value);
}

function customerItems(): DescriptionItem[] {
  return staff.value ? [{ term: 'Cliente', detail: customer.value!.name }] : [];
}

const review = computed<DescriptionItem[]>(() => {
  const values = form.values;
  return [
    ...customerItems(),
    { term: 'Serviço', detail: selectedType.value!.name },
    { term: 'Aparelho', detail: applianceDetail(values) },
    { term: 'Problema', detail: values.problem },
    { term: 'Fotos', detail: photosDetail(photos.value.length) },
    { term: 'Datas', detail: values.windows.map(formatWindow).join('; ') },
    { term: 'Endereço', detail: addressDetail(values) },
  ];
});

onMounted(() => Promise.all([loadTypes(), loadProfile()]));
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <div
      v-if="created"
      class="flex flex-col items-center gap-4 py-6 text-center"
      data-testid="request-success"
    >
      <span
        class="flex size-16 items-center justify-center rounded-full bg-success-soft text-on-success-soft"
      >
        <CircleCheck class="size-9" aria-hidden="true" />
      </span>
      <h2 class="text-2xl font-extrabold text-text">Pronto! Recebemos sua solicitação.</h2>
      <p class="max-w-md text-text-muted">
        A gente responde em até 1 dia útil. O número da solicitação é
        <strong class="text-text tabular-nums" data-testid="request-number">{{ created.id }}</strong
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
        <BaseButton :to="detailLink" :disabled="uploadProgress !== null">
          {{ staff ? 'Ver solicitação' : 'Ver agendamento' }}
        </BaseButton>
        <BaseButton variant="secondary" @click="startOver">Agendar outra visita</BaseButton>
      </div>
    </div>

    <form
      v-else
      class="flex flex-col gap-6"
      novalidate
      @submit.prevent="step === 'revisao' ? send() : next()"
    >
      <nav aria-label="Etapas">
        <p class="text-sm font-semibold text-text-muted md:hidden">
          Passo {{ current + 1 }} de {{ steps.length }}
        </p>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken md:hidden" aria-hidden="true">
          <div
            class="h-full rounded-full bg-primary transition-[width] duration-300"
            :style="{ width: `${((current + 1) / steps.length) * 100}%` }"
          />
        </div>
        <ol class="hidden gap-2 md:flex">
          <li v-for="(key, index) in steps" :key="key" class="flex-1">
            <button
              type="button"
              class="flex min-h-11 w-full flex-col gap-1.5 text-left text-sm font-semibold disabled:cursor-default"
              :class="index <= current ? 'text-link' : 'text-text-muted'"
              :disabled="index >= current"
              :aria-current="index === current ? 'step' : undefined"
              @click="goTo(index)"
            >
              <span
                class="h-1.5 w-full rounded-full"
                :class="index <= current ? 'bg-primary' : 'bg-surface-sunken'"
              />
              {{ index + 1 }}. {{ STEP_LABELS[key] }}
            </button>
          </li>
        </ol>
      </nav>

      <BaseCard>
        <h2
          ref="heading"
          tabindex="-1"
          class="mb-5 text-xl font-bold text-text outline-none"
          data-testid="step-title"
        >
          <template v-if="step === 'cliente'">Para qual cliente é a visita?</template>
          <template v-else-if="step === 'servico'">Qual serviço você precisa?</template>
          <template v-else-if="step === 'aparelho'">Qual é o aparelho?</template>
          <template v-else-if="step === 'problema'">O que está acontecendo?</template>
          <template v-else-if="step === 'datas'">Quais dias ficam bons?</template>
          <template v-else-if="step === 'endereco'">Onde vai ser a visita?</template>
          <template v-else>Confira e envie</template>
        </h2>

        <div v-if="step === 'cliente'" class="flex flex-col gap-2">
          <CounterCustomerPicker v-model="customer" />
          <p v-if="form.error('customerId')" class="text-sm font-medium text-danger" role="alert">
            {{ form.error('customerId') }}
          </p>
        </div>

        <div v-else-if="step === 'servico'">
          <ErrorState v-if="typesFailed" kind="server" :heading-level="3" @retry="loadTypes" />
          <div v-else-if="!types" class="grid gap-3 sm:grid-cols-2" role="status">
            <span class="sr-only">Carregando serviços…</span>
            <BaseSkeleton v-for="n in 4" :key="n" class="h-24 w-full rounded-lg" />
          </div>
          <fieldset v-else>
            <legend class="sr-only">Serviço</legend>
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
                />
                <img
                  :src="serviceIllustration(type.name)"
                  alt=""
                  width="64"
                  height="64"
                  class="size-16 shrink-0"
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
        </div>

        <div v-else-if="step === 'aparelho'" class="grid gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <BaseTextField
              v-model="form.values.productKind"
              label="Aparelho"
              placeholder="Geladeira duplex, split 12.000 BTUs…"
              :error="form.error('productKind')"
              required
            />
          </div>
          <BaseTextField
            v-model="form.values.brand"
            label="Marca"
            hint="Opcional."
            :error="form.error('brand')"
          />
          <BaseTextField
            v-model="form.values.model"
            label="Modelo"
            hint="Opcional. Fica na etiqueta do aparelho."
            :error="form.error('model')"
          />
        </div>

        <div v-else-if="step === 'problema'" class="flex flex-col gap-5">
          <BaseTextArea
            v-model="form.values.problem"
            label="Problema"
            placeholder="Desde quando, que barulho faz, se gela pouco…"
            :maxlength="2000"
            :rows="5"
            :error="form.error('problem')"
            required
          />
          <BasePhotoUpload
            v-model="photos"
            label="Fotos (opcional)"
            hint="Foto do aparelho, da etiqueta e do defeito ajudam o técnico."
            :max="MAX_REQUEST_PHOTOS"
          />
        </div>

        <ServiceWindowPicker
          v-else-if="step === 'datas'"
          v-model="form.values.windows"
          :error="form.error('windows')"
        />

        <div v-else-if="step === 'endereco'" class="flex flex-col gap-4">
          <fieldset v-if="!needsAddress" class="flex flex-col gap-2">
            <legend class="sr-only">Endereço da visita</legend>
            <label
              v-for="option in ADDRESS_OPTIONS"
              :key="option"
              class="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3"
              :class="form.values.addressMode === option ? 'border-primary bg-info-soft' : 'border-border'"
            >
              <input
                v-model="form.values.addressMode"
                type="radio"
                name="addressMode"
                :value="option"
                class="mt-1 size-4.5 accent-primary"
              />
              <span v-if="option === 'other'" class="font-semibold text-text">Outro endereço</span>
              <span v-else-if="staff" class="font-semibold text-text">Endereço do cadastro do cliente</span>
              <span v-else>
                <span class="block font-semibold text-text">Meu endereço</span>
                <span class="block text-sm text-text-muted">{{ formatAddress(profileAddress) }}</span>
              </span>
            </label>
          </fieldset>
          <BaseAlert v-else tone="info"
            >Seu cadastro não tem endereço. Informe onde vai ser a visita.</BaseAlert
          >
          <FormAddressFields
            v-if="needsAddress || form.values.addressMode === 'other'"
            v-model="form.values.address"
            :errors="form.errors.value"
            required
          />
        </div>

        <div v-else class="flex flex-col gap-4">
          <BaseDescriptionList :items="review" />
          <BaseAlert v-if="form.message.value" tone="danger">{{ form.message.value }}</BaseAlert>
        </div>
      </BaseCard>

      <div class="flex flex-wrap-reverse justify-between gap-3">
        <BaseButton v-if="current > 0" variant="secondary" @click="goTo(current - 1)">
          <ArrowLeft class="size-5" aria-hidden="true" />
          Voltar
        </BaseButton>
        <span v-else />
        <BaseButton v-if="step !== 'revisao'" type="submit">
          Continuar
          <ArrowRight class="size-5" aria-hidden="true" />
        </BaseButton>
        <BaseButton v-else type="submit" :loading="form.pending.value">
          <Send class="size-5" aria-hidden="true" />
          Enviar solicitação
        </BaseButton>
      </div>
    </form>
  </div>
</template>
