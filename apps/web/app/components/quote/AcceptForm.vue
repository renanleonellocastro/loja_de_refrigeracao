<script setup lang="ts">
import { CheckCheck } from 'lucide-vue-next';
import {
  addressToApi,
  emptyAddress,
  formatAddress,
  validateAddress,
  type AddressForm,
  type ApiAddress,
} from '~/utils/address';
import type { Quote } from '~/utils/quotes';
import type { VisitWindow } from '~/utils/service-requests';

/**
 * UC Aceitar Orçamento: the customer picks the days and periods that suit the visit and where it happens,
 * like /agendar. The API accepts the quote and creates the visit request in the same transaction.
 */
const props = defineProps<{ quoteId: number }>();
const emit = defineEmits<{ accepted: [quote: Quote, serviceRequestId: number]; close: [] }>();

const ADDRESS_OPTIONS = ['profile', 'other'] as const;

const api = useApi();
const profileAddress = ref<ApiAddress | null>(null);
const profileLoaded = ref(false);

interface Values extends Record<string, unknown> {
  windows: VisitWindow[];
  addressMode: 'profile' | 'other';
  address: AddressForm;
}

/** The customer has no address on file: the visit needs one typed here. */
const needsAddress = computed(() => !profileAddress.value);

const form = useForm<Values>(
  { windows: [], addressMode: 'profile', address: emptyAddress() },
  {
    inline: true,
    validate: (values) => {
      const errors: FieldErrors = {};
      if (values.windows.length === 0) errors.windows = 'Escolha pelo menos um dia e período.';
      if (values.addressMode === 'other' || needsAddress.value) {
        Object.assign(errors, validateAddress(values.address, true));
      }
      return errors;
    },
  },
);

async function loadProfile(): Promise<void> {
  try {
    profileAddress.value = (await unwrap(api.GET('/api/v1/me'))).address;
  } catch {
    // Without the profile the customer types the address; the acceptance itself still works.
    profileAddress.value = null;
  } finally {
    profileLoaded.value = true;
  }
}

async function accept(): Promise<void> {
  await form.submit(async (values) => {
    const otherAddress = values.addressMode === 'other' || needsAddress.value;
    const result = await unwrap(
      api.POST('/api/v1/quotes/{id}/acceptance', {
        params: { path: { id: props.quoteId } },
        body: {
          windows: values.windows,
          address: otherAddress ? addressToApi(values.address)! : undefined,
        },
      }),
    );
    emit('accepted', result.quote, result.serviceRequestId);
  });
}

onMounted(loadProfile);
</script>

<template>
  <BaseCard title="Aceitar orçamento" :heading-level="3">
    <form class="flex flex-col gap-6" novalidate @submit.prevent="accept">
      <p class="text-text-muted">
        Ao aceitar, a loja recebe um pedido de visita já preenchido. Escolha os dias que ficam bons e onde vai
        ser o serviço.
      </p>
      <fieldset class="flex flex-col gap-3">
        <legend class="mb-2 font-bold text-text">Quais dias ficam bons?</legend>
        <ServiceWindowPicker v-model="form.values.windows" :error="form.error('windows')" />
      </fieldset>

      <fieldset class="flex flex-col gap-3">
        <legend class="mb-2 font-bold text-text">Onde vai ser o serviço?</legend>
        <div v-if="!profileLoaded" role="status">
          <span class="sr-only">Carregando seu endereço…</span>
          <BaseSkeleton class="h-16 w-full rounded-lg" />
        </div>
        <template v-else>
          <div v-if="!needsAddress" class="flex flex-col gap-2">
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
              <span v-else>
                <span class="block font-semibold text-text">Meu endereço</span>
                <span class="block text-sm text-text-muted">{{ formatAddress(profileAddress) }}</span>
              </span>
            </label>
          </div>
          <BaseAlert v-else tone="info"
            >Seu cadastro não tem endereço. Informe onde vai ser o serviço.</BaseAlert
          >
          <FormAddressFields
            v-if="needsAddress || form.values.addressMode === 'other'"
            v-model="form.values.address"
            :errors="form.errors.value"
            required
          />
        </template>
      </fieldset>

      <BaseAlert v-if="form.message.value" tone="danger">{{ form.message.value }}</BaseAlert>
      <div class="flex flex-wrap-reverse justify-end gap-3">
        <BaseButton variant="secondary" @click="emit('close')">Voltar</BaseButton>
        <BaseButton type="submit" :loading="form.pending.value">
          <CheckCheck class="size-5" aria-hidden="true" />
          Aceitar e pedir visita
        </BaseButton>
      </div>
    </form>
  </BaseCard>
</template>
