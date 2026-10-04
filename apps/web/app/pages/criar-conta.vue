<script setup lang="ts">
/** UC Cadastrar Cliente by the customer (RF-04, RF-10): signs in at the end and sends the welcome email. */
definePageMeta({ layout: 'auth' });
useSeoMeta({
  title: 'Criar conta | Refrigeração Castro',
  description: 'Crie sua conta para comprar, pedir orçamento e agendar visitas da Refrigeração Castro.',
});

const auth = useAuthStore();
const api = useApi();
const route = useRoute();
const toast = useToast();
const redirect = computed(() => safeRedirect(route.query.redirect));
const loginLink = computed(() =>
  redirect.value ? `/entrar?redirect=${encodeURIComponent(redirect.value)}` : '/entrar',
);

const form = useForm(
  {
    name: '',
    email: '',
    phone: '',
    cpf: '',
    password: '',
    confirmation: '',
    address: emptyAddress(),
    acceptPrivacy: false,
  },
  {
    validate: (values) => ({
      ...validatePerson(values, { cpfRequired: false }),
      ...validateNewPassword(values.password, values.confirmation, 'password', 'confirmation'),
      ...validateAddress(values.address, false),
      ...(values.acceptPrivacy ? {} : { acceptPrivacy: 'Para criar a conta, aceite a política de privacidade.' }),
    }),
  },
);

async function submit(): Promise<void> {
  await form.submit(async (values) => {
    const session = await unwrap(
      api.POST('/api/v1/customers', {
        body: {
          name: values.name.trim(),
          email: values.email.trim(),
          phone: values.phone,
          password: values.password,
          cpf: values.cpf || null,
          address: addressToApi(values.address),
          acceptPrivacy: true,
        },
      }),
    );
    auth.apply(session);
    toast.success({
      title: `Pronto, ${firstName(session.user.name)}! Sua conta está criada.`,
      description: 'Enviamos um email de boas vindas com os seus dados.',
    });
    await navigateTo(redirect.value ?? landingFor(session.user.role));
  });
}
</script>

<template>
  <div>
    <p class="rc-eyebrow text-link">Minha conta</p>
    <h1 class="mt-2 text-3xl font-extrabold text-text sm:text-4xl">Criar conta</h1>
    <p class="mt-2 text-text-muted">
      Leva um minutinho. Com a conta você compra para retirar na loja, pede orçamento e agenda visitas.
    </p>

    <form class="mt-7 flex flex-col gap-8" novalidate @submit.prevent="submit">
      <fieldset class="flex flex-col gap-5">
        <legend class="mb-4 font-display text-lg font-bold text-text">Seus dados</legend>
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
          placeholder="nome@exemplo.com"
          :error="form.error('email')"
          required
        />
        <div class="grid gap-5 sm:grid-cols-2">
          <BaseMaskedField
            v-model="form.values.phone"
            mask="phone"
            label="Telefone"
            autocomplete="tel-national"
            hint="Com DDD. Usamos para combinar visitas."
            :error="form.error('phone')"
            required
          />
          <BaseMaskedField
            v-model="form.values.cpf"
            mask="cpf"
            label="CPF"
            hint="Opcional."
            :error="form.error('cpf')"
          />
        </div>
      </fieldset>

      <fieldset class="flex flex-col gap-5">
        <legend class="mb-4 font-display text-lg font-bold text-text">Senha</legend>
        <BasePasswordField
          v-model="form.values.password"
          label="Crie uma senha"
          autocomplete="new-password"
          show-strength
          :error="form.error('password')"
          required
        />
        <BasePasswordField
          v-model="form.values.confirmation"
          label="Confirme a senha"
          autocomplete="new-password"
          :error="form.error('confirmation')"
          hint="Digite a mesma senha de novo."
          required
        />
      </fieldset>

      <fieldset>
        <legend class="font-display text-lg font-bold text-text">Endereço</legend>
        <p class="mt-1 mb-4 text-sm text-text-muted">
          Opcional. Ajuda quando você pedir uma visita técnica; dá para preencher depois no perfil.
        </p>
        <FormAddressFields v-model="form.values.address" :errors="form.errors.value" />
      </fieldset>

      <div class="rounded-lg border border-border bg-surface-sunken/60 px-4 py-2">
        <BaseCheckbox
          v-model="form.values.acceptPrivacy"
          label="Li e aceito a política de privacidade"
          description="Seus dados servem só para atender você: pedidos, visitas e orçamentos."
        />
        <NuxtLink
          to="/privacidade"
          target="_blank"
          class="ml-8.5 inline-flex min-h-11 items-center text-sm font-semibold text-link hover:underline"
        >
          Ler a política de privacidade<span class="sr-only"> (abre em nova aba)</span>
        </NuxtLink>
        <p v-if="form.error('acceptPrivacy')" class="pb-2 text-sm font-medium text-danger" role="alert">
          {{ form.error('acceptPrivacy') }}
        </p>
      </div>

      <BaseButton type="submit" size="lg" block :loading="form.pending.value">Criar minha conta</BaseButton>
    </form>

    <p class="mt-6 text-center text-text-muted">
      Já tem conta?
      <NuxtLink :to="loginLink" class="inline-flex min-h-11 items-center font-semibold text-link hover:underline">
        Entrar
      </NuxtLink>
    </p>
  </div>
</template>
