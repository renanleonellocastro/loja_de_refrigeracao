<script setup lang="ts">
import type { ApiSchemas } from '@rc/contracts';

/** UC Editar Perfil (RF-03), address part: the CEP fills the rest. Leaving every field blank removes it. */
type Profile = ApiSchemas['UserDetail'];
const props = defineProps<{ profile: Profile }>();
const emit = defineEmits<{ saved: [profile: Profile] }>();

const api = useApi();
const toast = useToast();

const form = useForm(
  { address: addressFromApi(props.profile.address) },
  { validate: (values) => validateAddress(values.address, false) },
);

async function submit(): Promise<void> {
  await form.submit(async (values) => {
    const result = await unwrap(api.PATCH('/api/v1/me', { body: { address: addressToApi(values.address) } }));
    emit('saved', result.profile);
    form.reset({ address: addressFromApi(result.profile.address) });
    toast.success({
      title: result.profile.address ? 'Pronto! Endereço salvo.' : 'Endereço removido.',
    });
  });
}
</script>

<template>
  <BaseCard title="Endereço" description="Onde fazemos as visitas técnicas. Dá para deixar em branco.">
    <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
      <FormAddressFields v-model="form.values.address" :errors="form.errors.value" />
      <div class="flex justify-end">
        <BaseButton type="submit" :loading="form.pending.value">Salvar endereço</BaseButton>
      </div>
    </form>
  </BaseCard>
</template>
