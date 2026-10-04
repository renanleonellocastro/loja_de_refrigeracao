<script setup lang="ts">
import { MailCheck } from 'lucide-vue-next';

/** UC Recuperar Senha (RF-02): the answer is always the same, so nobody learns whether an email has an account. */
definePageMeta({ layout: 'auth' });
useSeoMeta({ title: 'Esqueci minha senha | Refrigeração Castro' });

const api = useApi();
const sentTo = ref('');

const form = useForm(
  { email: '' },
  {
    validate: (values): FieldErrors =>
      EMAIL_PATTERN.test(values.email.trim())
        ? {}
        : { email: 'Digite um email válido, como nome@exemplo.com.' },
  },
);

async function submit(): Promise<void> {
  await form.submit(async (values) => {
    await unwrap(api.POST('/api/v1/auth/password-resets', { body: { email: values.email.trim() } }));
    sentTo.value = values.email.trim();
  });
}
</script>

<template>
  <div v-if="sentTo" class="flex flex-col items-center text-center" role="status">
    <span class="flex size-16 items-center justify-center rounded-full bg-success-soft text-on-success-soft">
      <MailCheck class="size-7" aria-hidden="true" />
    </span>
    <h1 class="mt-5 text-3xl font-extrabold text-text">Confira seu email</h1>
    <p class="mt-3 text-text-muted">
      Se o email <strong class="font-semibold break-all text-text">{{ sentTo }}</strong> estiver cadastrado,
      você receberá um link em instantes.
    </p>
    <ul class="mt-6 w-full rounded-lg bg-surface-sunken/70 p-4 text-left text-sm text-text-muted">
      <li class="flex gap-2">
        <span aria-hidden="true">•</span> O link vale por 30 minutos e funciona uma vez só.
      </li>
      <li class="mt-1.5 flex gap-2">
        <span aria-hidden="true">•</span> Não chegou? Olhe a caixa de spam ou promoções.
      </li>
    </ul>
    <div class="mt-7 flex w-full flex-col gap-3">
      <BaseButton to="/entrar" size="lg" block>Voltar para entrar</BaseButton>
      <BaseButton variant="ghost" block @click="sentTo = ''">Usar outro email</BaseButton>
    </div>
  </div>
  <div v-else>
    <p class="rc-eyebrow text-link">Recuperar senha</p>
    <h1 class="mt-2 text-3xl font-extrabold text-text sm:text-4xl">Esqueci minha senha</h1>
    <p class="mt-2 text-text-muted">
      Acontece! Informe o email da sua conta e mandamos um link para você criar uma senha nova.
    </p>
    <form class="mt-7 flex flex-col gap-5" novalidate @submit.prevent="submit">
      <BaseTextField
        v-model="form.values.email"
        label="Email"
        type="email"
        inputmode="email"
        autocomplete="email"
        placeholder="nome@exemplo.com"
        :error="form.error('email')"
        required
      />
      <BaseButton type="submit" size="lg" block :loading="form.pending.value">Enviar link</BaseButton>
    </form>
    <p class="mt-6 text-center text-text-muted">
      Lembrou?
      <NuxtLink
        to="/entrar"
        class="inline-flex min-h-11 items-center font-semibold text-link hover:underline"
      >
        Entrar
      </NuxtLink>
    </p>
  </div>
</template>
