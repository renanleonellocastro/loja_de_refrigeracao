<script setup lang="ts">
import { STORE_INFO } from '~/utils/store';
import type { Component } from 'vue';
import { IllustrationLock, IllustrationThermometer } from '#components';

const props = withDefaults(
  defineProps<{ kind: ErrorKind; statusCode?: number; headingLevel?: 1 | 2 | 3 }>(),
  { statusCode: undefined, headingLevel: 1 },
);
const emit = defineEmits<{ retry: [] }>();

interface ErrorCopy {
  eyebrow: string;
  title: string;
  text: string;
  /** A line illustration component, or the path of a full color brand illustration. */
  illustration: Component | string;
  retry: boolean;
}

const COPY: Record<ErrorKind, ErrorCopy> = {
  'not-found': {
    eyebrow: 'Erro 404',
    title: 'Procuramos em todas as prateleiras',
    text: 'E não achamos esta página. Talvez o endereço tenha mudado ou tenha um errinho de digitação.',
    illustration: '/illustrations/erro-404.svg',
    retry: false,
  },
  server: {
    eyebrow: 'Erro no servidor',
    title: 'Algo esquentou por aqui',
    text: 'Tivemos um problema do nosso lado e já estamos de olho. Tente de novo em alguns instantes.',
    illustration: IllustrationThermometer,
    retry: true,
  },
  forbidden: {
    eyebrow: 'Sem permissão',
    title: 'Esta porta é só para a equipe',
    text: 'Sua conta não tem acesso a esta área. Se acha que deveria ter, fale com o gerente da loja.',
    illustration: IllustrationLock,
    retry: false,
  },
  offline: {
    eyebrow: 'Sem conexão',
    title: 'Parece que a internet caiu',
    text: 'Confira a rede sem fio ou os dados móveis. Assim que a conexão voltar, é só tentar de novo.',
    illustration: '/illustrations/erro-offline.svg',
    retry: true,
  },
};

const copy = computed(() => COPY[props.kind]);
const eyebrow = computed(() =>
  props.kind === 'server' && props.statusCode ? `Erro ${props.statusCode}` : copy.value.eyebrow,
);
</script>

<template>
  <section class="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center sm:py-24">
    <div class="relative mb-8 text-castro-600 dark:text-castro-300">
      <span class="absolute inset-0 -z-10 scale-125 rounded-full bg-info-soft blur-2xl" aria-hidden="true" />
      <img
        v-if="typeof copy.illustration === 'string'"
        :src="copy.illustration"
        alt=""
        width="480"
        height="360"
        class="h-44 w-auto sm:h-56"
      />
      <component :is="copy.illustration" v-else class="h-36 w-auto sm:h-44" />
    </div>
    <p class="rc-eyebrow text-link">{{ eyebrow }}</p>
    <component :is="`h${headingLevel}`" class="mt-3 text-3xl font-extrabold text-text sm:text-4xl">
      {{ copy.title }}
    </component>
    <p class="mt-4 text-lg text-text-muted">{{ copy.text }}</p>
    <div class="mt-8 flex flex-wrap justify-center gap-3">
      <BaseButton v-if="copy.retry" @click="emit('retry')">Tentar de novo</BaseButton>
      <BaseButton to="/" :variant="copy.retry ? 'secondary' : 'primary'">Voltar ao início</BaseButton>
      <BaseButton :to="STORE_INFO.phoneHref" variant="ghost">Ligar para a loja</BaseButton>
    </div>
  </section>
</template>
