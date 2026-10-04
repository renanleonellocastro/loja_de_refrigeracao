<script setup lang="ts">
import { formatCnpj } from '~/utils/masks';
import { WEEKDAYS } from '~/utils/staff';

/**
 * UC Configurar a Loja (RF-13): contact data, address, opening hours per weekday, the emails that get
 * team alerts and the default minimum stock of new products.
 */
definePageMeta({ layout: 'area', permission: 'store.manage', title: 'Configurações da loja' });
useHead({ title: 'Configurações | Refrigeração Castro' });

const api = useApi();
const toast = useToast();

const settings = ref<StoreSettings | null>(null);
const failed = ref(false);
const form = useForm<StoreForm>(
  {
    name: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: emptyAddress(),
    openingHours: {},
    notificationEmails: '',
    defaultStockMin: '0',
  },
  { validate: validateStoreForm },
);

async function load(): Promise<void> {
  failed.value = false;
  try {
    const found = await unwrap(api.GET('/api/v1/store/settings'));
    form.reset(storeFormFrom(found));
    settings.value = found;
  } catch {
    failed.value = true;
  }
}

async function save(): Promise<void> {
  await form.submit(async (values) => {
    const saved = await unwrap(api.PATCH('/api/v1/store', { body: storeFormToApi(values) }));
    settings.value = saved;
    form.reset(storeFormFrom(saved));
    toast.success({ title: 'Pronto! As configurações da loja foram salvas.' });
  });
}

onMounted(load);
</script>

<template>
  <div class="mx-auto flex max-w-4xl flex-col gap-6">
    <ErrorState v-if="failed" kind="server" :heading-level="2" @retry="load" />

    <div v-else-if="!settings" class="flex flex-col gap-6" role="status">
      <span class="sr-only">Carregando configurações…</span>
      <BaseSkeleton v-for="index in 4" :key="index" class="h-56 w-full rounded-xl" />
    </div>

    <form v-else class="flex flex-col gap-6" novalidate @submit.prevent="save">
      <BaseCard
        title="Dados da loja"
        :description="`${settings.legalName} · CNPJ ${formatCnpj(settings.cnpj)}. Razão social e CNPJ só mudam com o suporte.`"
      >
        <div class="flex flex-col gap-5">
          <BaseTextField
            v-model="form.values.name"
            label="Nome da loja"
            :error="form.error('name')"
            required
          />
          <div class="grid gap-5 sm:grid-cols-2">
            <BaseMaskedField
              v-model="form.values.phone"
              mask="phone"
              label="Telefone"
              :error="form.error('phone')"
              required
            />
            <BaseMaskedField
              v-model="form.values.whatsapp"
              mask="phone"
              label="WhatsApp"
              hint="Opcional. Aparece no botão verde do site."
              :error="form.error('whatsapp')"
            />
          </div>
          <BaseTextField
            v-model="form.values.email"
            label="Email de contato"
            type="email"
            inputmode="email"
            :error="form.error('email')"
            required
          />
        </div>
      </BaseCard>

      <BaseCard title="Endereço" description="Aparece no rodapé, na página de contato e nos emails.">
        <FormAddressFields v-model="form.values.address" :errors="form.errors.value" required />
      </BaseCard>

      <BaseCard title="Horário de funcionamento" description="Desligue os dias em que a loja fica fechada.">
        <ul class="flex flex-col divide-y divide-border">
          <li
            v-for="day in WEEKDAYS"
            :key="day.key"
            class="grid gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[12rem_1fr] sm:items-center"
          >
            <BaseSwitch
              v-model="form.values.openingHours[day.key]!.open"
              :label="day.label"
              :description="form.values.openingHours[day.key]!.open ? 'Aberto' : 'Fechado'"
            />
            <div v-if="form.values.openingHours[day.key]!.open" class="grid grid-cols-2 gap-3">
              <BaseTextField
                v-model="form.values.openingHours[day.key]!.opens"
                :label="`Abre na ${day.label}`"
                type="time"
                :error="form.error(`openingHours.${day.key}.opens`)"
              />
              <BaseTextField
                v-model="form.values.openingHours[day.key]!.closes"
                :label="`Fecha na ${day.label}`"
                type="time"
                :error="form.error(`openingHours.${day.key}.closes`)"
              />
            </div>
          </li>
        </ul>
      </BaseCard>

      <BaseCard title="Avisos e estoque">
        <div class="flex flex-col gap-5">
          <BaseTextArea
            v-model="form.values.notificationEmails"
            label="Emails que recebem os avisos da equipe"
            hint="Um por linha, até 10. Recebem os avisos enviados para a equipe da loja."
            :rows="3"
            :error="form.error('notificationEmails')"
          />
          <BaseTextField
            v-model="form.values.defaultStockMin"
            label="Estoque mínimo padrão"
            type="number"
            inputmode="numeric"
            suffix="unidades"
            hint="Valor inicial para produtos novos. Abaixo dele, avisamos que o estoque está baixo."
            :error="form.error('defaultStockMin')"
            required
          />
        </div>
      </BaseCard>

      <div class="flex justify-end">
        <BaseButton type="submit" :loading="form.pending.value">Salvar configurações</BaseButton>
      </div>
    </form>
  </div>
</template>
