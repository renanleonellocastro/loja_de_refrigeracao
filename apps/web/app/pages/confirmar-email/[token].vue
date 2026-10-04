<script setup lang="ts">
import { LinkIcon, MailCheck } from 'lucide-vue-next';

/** UC Editar Perfil, step 4: a new email only counts after the link sent to it is opened. */
definePageMeta({ layout: 'auth' });
useSeoMeta({ title: 'Confirmar email | Refrigeração Castro', robots: 'noindex' });

const route = useRoute();
const api = useApi();
const auth = useAuthStore();
const state = ref<'loading' | 'done' | 'expired' | 'error'>('loading');
const message = ref('');

async function confirm(): Promise<void> {
  state.value = 'loading';
  try {
    await unwrap(
      api.POST('/api/v1/auth/email-verifications/{token}', {
        params: { path: { token: String(route.params.token) } },
      }),
    );
    state.value = 'done';
  } catch (caught) {
    const error = toApiError(caught);
    state.value = error.status === 410 || error.status === 404 || error.status === 422 ? 'expired' : 'error';
    message.value = error.message;
  }
}

onMounted(confirm);
</script>

<template>
  <div class="flex flex-col items-center text-center" aria-live="polite">
    <template v-if="state === 'loading'">
      <BaseSpinner class="size-10 text-link" />
      <h1 class="mt-5 text-2xl font-extrabold text-text">Confirmando seu email…</h1>
    </template>
    <template v-else-if="state === 'done'">
      <span class="flex size-16 items-center justify-center rounded-full bg-success-soft text-on-success-soft">
        <MailCheck class="size-7" aria-hidden="true" />
      </span>
      <h1 class="mt-5 text-3xl font-extrabold text-text">Email confirmado!</h1>
      <p class="mt-3 text-text-muted">A partir de agora, use o novo email para entrar e receber nossos avisos.</p>
      <BaseButton :to="auth.signedIn ? '/perfil' : '/entrar'" size="lg" block class="mt-7">
        {{ auth.signedIn ? 'Voltar ao perfil' : 'Entrar' }}
      </BaseButton>
    </template>
    <template v-else>
      <span class="flex size-16 items-center justify-center rounded-full bg-warning-soft text-on-warning-soft">
        <LinkIcon class="size-7" aria-hidden="true" />
      </span>
      <h1 class="mt-5 text-3xl font-extrabold text-text">
        {{ state === 'expired' ? 'Este link não vale mais' : 'Não deu para confirmar agora' }}
      </h1>
      <p class="mt-3 text-text-muted">
        {{
          state === 'expired'
            ? 'O link de confirmação já foi usado ou venceu. Troque o email de novo no perfil para receber outro.'
            : message
        }}
      </p>
      <div class="mt-7 flex w-full flex-col gap-3">
        <BaseButton v-if="state === 'error'" size="lg" block @click="confirm">Tentar de novo</BaseButton>
        <BaseButton to="/perfil" :variant="state === 'error' ? 'secondary' : 'primary'" size="lg" block>
          Ir para o perfil
        </BaseButton>
      </div>
    </template>
  </div>
</template>
