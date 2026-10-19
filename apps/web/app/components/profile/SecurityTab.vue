<script setup lang="ts">
/** UC Alterar Senha (RF-06): asks for the current password; the other sessions end, this one stays. */
const api = useApi();
const toast = useToast();

const EMPTY = { currentPassword: '', newPassword: '', confirmation: '' };

const form = useForm(EMPTY, {
  validate: (values) => ({
    ...(values.currentPassword ? {} : { currentPassword: 'Digite a senha que você usa hoje.' }),
    ...validateNewPassword(values.newPassword, values.confirmation, 'newPassword', 'confirmation'),
  }),
});

type PasswordValues = typeof EMPTY;

async function changePassword(values: PasswordValues): Promise<void> {
  const body = { currentPassword: values.currentPassword, newPassword: values.newPassword };
  await unwrap(api.PUT('/api/v1/me/password', { body }));
}

async function submit(): Promise<void> {
  if (!(await form.submit(changePassword))) return;
  form.reset(EMPTY);
  toast.success({
    title: 'Senha alterada!',
    description: 'Por segurança, encerramos suas sessões em outros aparelhos.',
  });
}
</script>

<template>
  <BaseCard title="Alterar senha" description="Escolha uma senha que você não usa em outros sites.">
    <form class="flex max-w-md flex-col gap-5" novalidate @submit.prevent="submit">
      <BasePasswordField
        v-model="form.values.currentPassword"
        label="Senha atual"
        autocomplete="current-password"
        :error="form.error('currentPassword')"
        required
      />
      <BasePasswordField
        v-model="form.values.newPassword"
        label="Nova senha"
        autocomplete="new-password"
        show-strength
        :error="form.error('newPassword')"
        required
      />
      <BasePasswordField
        v-model="form.values.confirmation"
        label="Confirme a nova senha"
        autocomplete="new-password"
        hint="Digite a mesma senha de novo."
        :error="form.error('confirmation')"
        required
      />
      <div>
        <BaseButton type="submit" :loading="form.pending.value">Alterar senha</BaseButton>
      </div>
    </form>
  </BaseCard>
</template>
