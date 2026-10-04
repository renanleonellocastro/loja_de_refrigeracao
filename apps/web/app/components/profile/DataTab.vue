<script setup lang="ts">
import type { ApiSchemas } from '@rc/contracts';

/** UC Editar Perfil (RF-03): name, email, phone and CPF. A new email only counts after it is confirmed. */
type Profile = ApiSchemas['UserDetail'];
const props = defineProps<{ profile: Profile }>();
const emit = defineEmits<{ saved: [profile: Profile] }>();

const api = useApi();
const toast = useToast();
const isClient = computed(() => props.profile.role === 'CLIENT');

function fromProfile(profile: Profile) {
  return { name: profile.name, email: profile.email, phone: profile.phone ?? '', cpf: profile.cpf ?? '' };
}

const form = useForm(fromProfile(props.profile), {
  validate: (values) => validatePerson(values, { cpfRequired: false, phoneRequired: isClient.value }),
});

async function submit(): Promise<void> {
  await form.submit(async (values) => {
    const result = await unwrap(
      api.PATCH('/api/v1/me', {
        body: {
          name: values.name.trim(),
          email: values.email.trim(),
          phone: values.phone || null,
          cpf: values.cpf || null,
        },
      }),
    );
    emit('saved', result.profile);
    form.reset(fromProfile(result.profile));
    if (result.emailVerificationPending) {
      toast.info({
        title: 'Dados salvos. Falta confirmar o email novo.',
        description: 'Enviamos um link para ele. Até você confirmar, seguimos usando o email antigo.',
      });
    } else {
      toast.success({ title: 'Pronto! Seus dados foram atualizados.' });
    }
  });
}
</script>

<template>
  <BaseCard title="Seus dados" description="Usamos estes dados para falar com você sobre pedidos e visitas.">
    <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
      <BaseTextField
        v-model="form.values.name"
        label="Nome completo"
        autocomplete="name"
        :error="form.error('name')"
        required
      />
      <BaseTextField
        v-model="form.values.email"
        label="Email"
        type="email"
        inputmode="email"
        autocomplete="email"
        hint="Se trocar, enviamos um link de confirmação para o email novo."
        :error="form.error('email')"
        required
      />
      <div class="grid gap-5 sm:grid-cols-2">
        <BaseMaskedField
          v-model="form.values.phone"
          mask="phone"
          label="Telefone"
          autocomplete="tel-national"
          :hint="isClient ? 'Com DDD. Usamos para combinar visitas.' : 'Opcional.'"
          :error="form.error('phone')"
          :required="isClient"
        />
        <BaseMaskedField
          v-model="form.values.cpf"
          mask="cpf"
          label="CPF"
          hint="Opcional."
          :error="form.error('cpf')"
        />
      </div>
      <div class="flex justify-end">
        <BaseButton type="submit" :loading="form.pending.value">Salvar alterações</BaseButton>
      </div>
    </form>
  </BaseCard>
</template>
