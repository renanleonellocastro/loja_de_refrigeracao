<script setup lang="ts">
import { Download, Trash2 } from 'lucide-vue-next';

/** UCs Exportar Meus Dados e Excluir Minha Conta (RF-10, LGPD). Only customers see this tab. */
const EXPORT_FILE = 'meus-dados-refrigeracao-castro.json';

const api = useApi();
const auth = useAuthStore();
const toast = useToast();
const exporting = ref(false);
const deleting = ref(false);

const form = useForm(
  { password: '' },
  {
    inline: true,
    validate: (values): FieldErrors =>
      values.password ? {} : { password: 'Digite sua senha para confirmar.' },
  },
);

async function exportData(): Promise<void> {
  exporting.value = true;
  try {
    const data = await unwrap(api.GET('/api/v1/me/data-export'));
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = EXPORT_FILE;
    link.click();
    URL.revokeObjectURL(url);
    toast.success({ title: 'Pronto! Baixamos o arquivo com os seus dados.' });
  } catch (error) {
    toast.error({ title: toApiError(error).message });
  } finally {
    exporting.value = false;
  }
}

function openDelete(): void {
  form.reset({ password: '' });
  deleting.value = true;
}

async function deleteAccount(): Promise<void> {
  const done = await form.submit(async (values) => {
    await unwrap(api.DELETE('/api/v1/me', { body: { password: values.password } }));
  });
  if (!done) return;
  deleting.value = false;
  auth.clear();
  toast.success({
    title: 'Sua conta foi excluída.',
    description: 'Obrigado por ter sido nosso cliente. As portas da loja continuam abertas.',
  });
  await navigateTo('/');
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <BaseCard title="Baixar meus dados" description="Um arquivo JSON com tudo o que guardamos sobre você.">
      <p class="text-sm text-text-muted">
        Inclui seus dados de cadastro, pedidos, orçamentos e agendamentos. Saiba mais na
        <NuxtLink to="/privacidade" class="font-semibold text-link hover:underline"
          >política de privacidade</NuxtLink
        >.
      </p>
      <template #footer>
        <BaseButton variant="secondary" :loading="exporting" @click="exportData">
          <Download class="size-4" aria-hidden="true" />
          Baixar meus dados
        </BaseButton>
      </template>
    </BaseCard>

    <BaseCard title="Excluir minha conta" description="Essa ação não tem volta.">
      <p class="text-sm text-text-muted">
        Apagamos seus dados pessoais e você sai de todos os aparelhos. Pedidos e serviços ficam guardados sem
        o seu nome, porque a loja precisa deles para as obrigações fiscais.
      </p>
      <template #footer>
        <BaseButton variant="danger" @click="openDelete">
          <Trash2 class="size-4" aria-hidden="true" />
          Excluir minha conta
        </BaseButton>
      </template>
    </BaseCard>

    <BaseDialog
      v-model:open="deleting"
      title="Excluir sua conta?"
      description="Seus dados pessoais são apagados na hora e você sai do site. Não dá para desfazer."
      size="sm"
    >
      <form id="delete-account" class="flex flex-col gap-4" novalidate @submit.prevent="deleteAccount">
        <BaseAlert v-if="form.message.value" tone="danger">{{ form.message.value }}</BaseAlert>
        <BasePasswordField
          v-model="form.values.password"
          label="Sua senha"
          autocomplete="current-password"
          :error="form.error('password')"
          required
        />
      </form>
      <template #footer>
        <BaseButton variant="ghost" @click="deleting = false">Cancelar</BaseButton>
        <BaseButton type="submit" form="delete-account" variant="danger" :loading="form.pending.value">
          Excluir minha conta
        </BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>
