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

const api = useApi();
const auth = useAuthStore();
const route = useRoute();
const config = useRuntimeConfig();

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
const uploadProgress = ref<number | null>(null);
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

const form = useForm<Values>(
  {
    customerId: 0,
    serviceTypeId: typeof route.query.servico === 'string' ? route.query.servico : '',
    productKind: '',
    brand: '',
    model: '',
    problem: '',
    windows: [],
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

function validateStep(key: StepKey, values: Values): FieldErrors {
  const errors: FieldErrors = {};
  if (key === 'cliente' && !values.customerId) errors.customerId = 'Escolha o cliente.';
  if (key === 'servico' && !values.serviceTypeId) errors.serviceTypeId = 'Escolha o serviço.';
  if (key === 'aparelho' && values.productKind.trim().length < 2) {
    errors.productKind = 'Diga qual é o aparelho, como geladeira duplex.';
  }
  if (key === 'problema' && values.problem.trim().length < 10) {
    errors.problem = 'Conte um pouco mais sobre o problema, com pelo menos 10 letras.';
  }
  if (key === 'datas' && values.windows.length === 0) errors.windows = 'Escolha pelo menos um dia e período.';
  if (key === 'endereco' && (values.addressMode === 'other' || needsAddress.value)) {
    Object.assign(errors, validateAddress(values.address, true));
  }
  return errors;
}

function validateAll(values: Values): FieldErrors {
  return Object.assign({}, ...steps.value.map((key) => validateStep(key, values)));
}

/** Step of a field path, to bring the person back to the field the API refused. */
function stepOf(path: string): StepKey {
  const root = path.split('.')[0]!;
  const map: Record<string, StepKey> = {
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
  return map[root]!;
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
  const body = new FormData();
  for (const file of photos.value) body.append('files', file, file.name);
  uploadProgress.value = 0;
  try {
    const result = await uploadWithProgress(
      `${config.public.apiBase}/api/v1/service-requests/${id}/photos`,
      body,
      auth.accessToken,
      (percent) => (uploadProgress.value = percent),
    );
    if (result.status !== 201) throw problemToError(result.status, result.body);
  } catch {
    photoWarning.value =
      'Sua solicitação foi registrada, mas as fotos não chegaram. Mande pela conversa do agendamento se precisar.';
  } finally {
    uploadProgress.value = null;
  }
}

async function send(): Promise<void> {
  const ok = await form.submit(async (values) => {
    const otherAddress = values.addressMode === 'other' || needsAddress.value;
    const result = await api.POST('/api/v1/service-requests', {
      body: {
        customerId: staff.value ? values.customerId : undefined,
        serviceTypeId: Number(values.serviceTypeId),
        productKind: values.productKind.trim(),
        brand: values.brand.trim() || undefined,
        model: values.model.trim() || undefined,
        problem: values.problem.trim(),
        windows: values.windows,
        address: otherAddress ? addressToApi(values.address)! : undefined,
      },
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    // The API answered: the next attempt is a new request.
    idempotencyKey = crypto.randomUUID();
    if (!result.data) throw problemToError(result.response.status, result.error);
    created.value = result.data;
  });
  if (!ok) {
    const first = Object.keys(form.errors.value)[0];
    if (first) await goTo(steps.value.indexOf(stepOf(first)));
    return;
  }
  if (photos.value.length > 0) await uploadPhotos(created.value!.id);
}

function startOver(): void {
  created.value = null;
  photos.value = [];
  photoWarning.value = '';
  customer.value = null;
  form.reset({
    ...form.values,
    serviceTypeId: '',
    productKind: '',
    brand: '',
    model: '',
    problem: '',
    windows: [],
  });
  current.value = 0;
}

const detailLink = computed(() =>
  staff.value ? `/solicitacoes/${created.value!.id}` : `/minha-conta/agendamentos/${created.value!.id}`,
);

const review = computed<DescriptionItem[]>(() => {
  const values = form.values;
  const otherAddress = values.addressMode === 'other' || needsAddress.value;
  const items: DescriptionItem[] = [];
  if (staff.value) items.push({ term: 'Cliente', detail: customer.value!.name });
  items.push(
    { term: 'Serviço', detail: selectedType.value!.name },
    {
      term: 'Aparelho',
      detail: [values.productKind, values.brand, values.model].filter(Boolean).join(' · '),
    },
    { term: 'Problema', detail: values.problem },
    {
      term: 'Fotos',
      detail: photos.value.length ? `${photos.value.length} de ${MAX_REQUEST_PHOTOS}` : 'Nenhuma',
    },
    { term: 'Datas', detail: values.windows.map(formatWindow).join('; ') },
    {
      term: 'Endereço',
      detail: otherAddress
        ? formatAddress(addressToApi(values.address))
        : staff.value
          ? 'Endereço do cadastro do cliente'
          : formatAddress(profileAddress.value),
    },
  );
  return items;
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
