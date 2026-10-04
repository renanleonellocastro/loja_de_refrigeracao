<script setup lang="ts">
import { CONTROL_INPUT_CLASSES, controlFrameClasses } from '~/utils/ui';
import { UF_OPTIONS, type AddressForm } from '~/utils/address';

/**
 * Address inputs with CEP autocomplete (GET /addresses/lookup): typing the 8 digits fills street, district,
 * city and UF, then moves the focus to the number. Errors come by path, for example `address.cep`.
 */
const props = withDefaults(
  defineProps<{ errors?: FieldErrors; prefix?: string; required?: boolean; disabled?: boolean }>(),
  { errors: () => ({}), prefix: 'address' },
);
const address = defineModel<AddressForm>({ required: true });

type LookupState = 'idle' | 'loading' | 'found' | 'not-found';
const state = ref<LookupState>('idle');
const numberField = useTemplateRef<{ focus: () => void }>('numberField');
const api = useApi();
// The saved CEP does not need a lookup; only a CEP the person types does.
let lastLooked = address.value.cep;

const error = (field: keyof AddressForm) => props.errors[`${props.prefix}.${field}`];

const HINTS: Record<LookupState, string | undefined> = {
  idle: 'Digite o CEP e a gente completa.',
  loading: 'Buscando o endereço…',
  found: 'Achamos! Confira e informe o número.',
  'not-found': 'Não achamos esse CEP. Preencha o endereço à mão.',
};

watch(
  () => address.value.cep,
  async (cep) => {
    if (cep.length !== 8 || cep === lastLooked) return;
    lastLooked = cep;
    state.value = 'loading';
    try {
      const found = await unwrap(api.GET('/api/v1/addresses/lookup', { params: { query: { cep } } }));
      address.value = {
        ...address.value,
        street: found.street,
        district: found.district,
        city: found.city,
        state: found.state,
      };
      state.value = 'found';
      await nextTick();
      numberField.value?.focus();
    } catch {
      state.value = 'not-found';
    }
  },
);
</script>

<template>
  <div class="grid grid-cols-6 gap-4">
    <div class="col-span-6 sm:col-span-3">
      <BaseMaskedField
        v-model="address.cep"
        mask="cep"
        label="CEP"
        autocomplete="postal-code"
        :hint="HINTS[state]"
        :error="error('cep')"
        :required="required"
        :disabled="disabled"
        :aria-busy="state === 'loading' || undefined"
      />
    </div>
    <div class="col-span-6">
      <BaseTextField
        v-model="address.street"
        label="Rua"
        autocomplete="address-line1"
        :error="error('street')"
        :required="required"
        :disabled="disabled"
      />
    </div>
    <div class="col-span-2">
      <BaseTextField
        ref="numberField"
        v-model="address.number"
        label="Número"
        inputmode="numeric"
        :error="error('number')"
        :required="required"
        :disabled="disabled"
      />
    </div>
    <div class="col-span-4">
      <BaseTextField
        v-model="address.complement"
        label="Complemento"
        hint="Opcional. Apto, bloco, fundos…"
        autocomplete="address-line2"
        :error="error('complement')"
        :disabled="disabled"
      />
    </div>
    <div class="col-span-6 sm:col-span-3">
      <BaseTextField
        v-model="address.district"
        label="Bairro"
        :error="error('district')"
        :required="required"
        :disabled="disabled"
      />
    </div>
    <div class="col-span-4 sm:col-span-2">
      <BaseTextField
        v-model="address.city"
        label="Cidade"
        autocomplete="address-level2"
        :error="error('city')"
        :required="required"
        :disabled="disabled"
      />
    </div>
    <div class="col-span-2 sm:col-span-1">
      <BaseField label="UF" :error="error('state')" :required="required">
        <template #default="{ id, describedBy, invalid }">
          <div :class="controlFrameClasses(invalid, disabled)">
            <select
              :id="id"
              v-model="address.state"
              :class="[CONTROL_INPUT_CLASSES, 'cursor-pointer appearance-none']"
              autocomplete="address-level1"
              :required="required"
              :disabled="disabled"
              :aria-invalid="invalid || undefined"
              :aria-describedby="describedBy"
            >
              <option value="" disabled>UF</option>
              <option v-for="uf in UF_OPTIONS" :key="uf" :value="uf">{{ uf }}</option>
            </select>
          </div>
        </template>
      </BaseField>
    </div>
  </div>
</template>
