<script setup lang="ts">
/** UC Autenticar (RF-01): email and password, back to where the person came from or to the role's home. */
definePageMeta({ layout: 'auth' });
useSeoMeta({ title: 'Entrar | Refrigeração Castro', description: 'Entre na sua conta da Refrigeração Castro.' });

const auth = useAuthStore();
const route = useRoute();
const toast = useToast();

const redirect = computed(() => safeRedirect(route.query.redirect));
const signUpLink = computed(() =>
  redirect.value ? `/criar-conta?redirect=${encodeURIComponent(redirect.value)}` : '/criar-conta',
);

const form = useForm(
  { email: '', password: '' },
  {
    validate: (values) => {
      const errors: FieldErrors = {};
      if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = 'Digite um email válido, como nome@exemplo.com.';
      if (!values.password) errors.password = 'Digite sua senha.';
      return errors;
    },
    inline: true,
  },
);

async function goHome(role: Parameters<typeof landingFor>[0], replace = false): Promise<void> {
  await navigateTo(redirect.value ?? landingFor(role), { replace });
}

async function submit(): Promise<void> {
  await form.submit(async (values) => {
    const user = await auth.login(values.email.trim(), values.password);
    toast.success({ title: `Olá, ${firstName(user.name)}! Que bom te ver.` });
    await goHome(user.role);
  });
}

// Someone already signed in who opens this page goes straight to their area.
watch(
  () => auth.user,
  (user) => {
    if (user && !form.pending.value) void goHome(user.role, true);
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <p class="rc-eyebrow text-link">Minha conta</p>
    <h1 class="mt-2 text-3xl font-extrabold text-text sm:text-4xl">Entrar</h1>
    <p class="mt-2 text-text-muted">
      {{
        redirect
          ? 'Entre para continuar de onde você parou.'
          : 'Que bom te ver de novo! Acompanhe pedidos, visitas e orçamentos.'
      }}
    </p>

    <form class="mt-7 flex flex-col gap-5" novalidate @submit.prevent="submit">
      <BaseAlert v-if="form.message.value" tone="danger">{{ form.message.value }}</BaseAlert>
      <BaseTextField
        v-model="form.values.email"
        label="Email"
        type="email"
        inputmode="email"
        autocomplete="username"
        placeholder="nome@exemplo.com"
        :error="form.error('email')"
        required
      />
      <div class="flex flex-col gap-1.5">
        <BasePasswordField
          v-model="form.values.password"
          autocomplete="current-password"
          :error="form.error('password')"
          required
        />
        <NuxtLink
          to="/esqueci-minha-senha"
          class="inline-flex min-h-11 items-center self-end text-sm font-semibold text-link hover:underline"
        >
          Esqueci minha senha
        </NuxtLink>
      </div>
      <BaseButton type="submit" size="lg" block :loading="form.pending.value">
        Entrar
      </BaseButton>
    </form>

    <div class="mt-8 flex items-center gap-3 text-sm text-text-muted">
      <span class="h-px flex-1 bg-border" aria-hidden="true" />
      Primeira vez por aqui?
      <span class="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
    <BaseButton :to="signUpLink" variant="secondary" size="lg" block class="mt-4">
      Criar minha conta
    </BaseButton>
  </div>
</template>
