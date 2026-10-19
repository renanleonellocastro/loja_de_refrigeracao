<script setup lang="ts">
import { LinkIcon } from 'lucide-vue-next';
import { STORE_INFO } from '~/utils/store';

/**
 * Sets a password from an emailed link: recovery (/redefinir-senha) or invitation (/definir-senha).
 * Both sign the person in; a used or expired link explains how to get a new one.
 */
const props = defineProps<{ kind: 'reset' | 'invitation'; token: string }>();

const api = useApi();
const auth = useAuthStore();
const toast = useToast();
const expired = ref(false);

const COPY = {
  reset: {
    eyebrow: 'Recuperar senha',
    title: 'Crie uma nova senha',
    text: 'Escolha uma senha que você não usa em outros sites. Depois disso, as outras sessões são encerradas.',
    button: 'Salvar nova senha',
    success: 'Senha nova salva! Você já está dentro.',
    expiredText:
      'Os links de recuperação valem por 30 minutos e funcionam uma vez só. Peça outro e use o mais recente.',
  },
  invitation: {
    eyebrow: 'Convite',
    title: 'Boas vindas à Refrigeração Castro!',
    text: 'Falta só criar sua senha para acessar sua conta.',
    button: 'Criar senha e entrar',
    success: 'Senha criada! Sua conta está pronta.',
    expiredText:
      'Este convite já foi usado ou venceu. Peça um link para criar a senha pelo "Esqueci minha senha" ou fale com a loja.',
  },
} as const;
const copy = computed(() => COPY[props.kind]);

const form = useForm(
  { password: '', confirmation: '' },
  {
    validate: (values) =>
      validateNewPassword(values.password, values.confirmation, 'password', 'confirmation'),
  },
);

/** Statuses of a used or expired link; 404 also means a malformed token, the same as a bad link for the person. */
const EXPIRED_LINK_STATUSES = new Set([410, 404]);

function setPassword(password: string) {
  const body = { password };
  const params = { path: { token: props.token } };
  return unwrap(
    props.kind === 'reset'
      ? api.POST('/api/v1/auth/password-resets/{token}', { params, body })
      : api.POST('/api/v1/auth/invitations/{token}', { params, body }),
  );
}

async function signIn(password: string): Promise<void> {
  const session = await setPassword(password);
  auth.apply(session);
  toast.success({ title: copy.value.success });
  await navigateTo(landingFor(session.user.role));
}

async function signInOrExplainLink(values: { password: string }): Promise<void> {
  try {
    await signIn(values.password);
  } catch (error) {
    if (!(error instanceof ApiError && EXPIRED_LINK_STATUSES.has(error.status))) throw error;
    expired.value = true;
  }
}

async function submit(): Promise<void> {
  await form.submit(signInOrExplainLink);
}
</script>

<template>
  <div v-if="expired" class="flex flex-col items-center text-center" role="status">
    <span class="flex size-16 items-center justify-center rounded-full bg-warning-soft text-on-warning-soft">
      <LinkIcon class="size-7" aria-hidden="true" />
    </span>
    <h1 class="mt-5 text-3xl font-extrabold text-text">Este link não vale mais</h1>
    <p class="mt-3 text-text-muted">{{ copy.expiredText }}</p>
    <div class="mt-7 flex w-full flex-col gap-3">
      <BaseButton to="/esqueci-minha-senha" size="lg" block>Pedir um novo link</BaseButton>
      <BaseButton :to="STORE_INFO.phoneHref" variant="ghost" block>Ligar para a loja</BaseButton>
    </div>
  </div>
  <div v-else>
    <p class="rc-eyebrow text-link">{{ copy.eyebrow }}</p>
    <h1 class="mt-2 text-3xl font-extrabold text-text sm:text-4xl">{{ copy.title }}</h1>
    <p class="mt-2 text-text-muted">{{ copy.text }}</p>
    <form class="mt-7 flex flex-col gap-5" novalidate @submit.prevent="submit">
      <BasePasswordField
        v-model="form.values.password"
        label="Nova senha"
        autocomplete="new-password"
        show-strength
        :error="form.error('password')"
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
      <BaseButton type="submit" size="lg" block :loading="form.pending.value">{{ copy.button }}</BaseButton>
    </form>
  </div>
</template>
