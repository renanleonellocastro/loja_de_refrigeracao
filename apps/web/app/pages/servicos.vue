<script setup lang="ts">
import { CalendarPlus, Clock, ReceiptText } from 'lucide-vue-next';
import { durationLabel, serviceIllustration } from '~/utils/service-requests';
import { STORE_INFO } from '~/utils/store';

/** Public page of the service types (RF-30): what the store fixes, with the way to book a visit or ask a quote. */
usePageSeo({
  title: 'Serviços | Refrigeração Castro',
  description:
    'Conserto de geladeira, freezer, lavadora e bebedouro, instalação e manutenção de ar condicionado em Mogi Mirim.',
  path: '/servicos',
});

const api = useApi();

const { data, status, refresh } = await useAsyncData('service-types', () =>
  unwrap(api.GET('/api/v1/service-types')),
);

const types = computed(() => (data.value ?? []).filter((type) => type.active));
</script>

<template>
  <div>
    <section class="rc-wall relative overflow-hidden">
      <FrostLines class="pointer-events-none absolute -right-24 bottom-4 w-[40rem] text-frost-300/30" />
      <div class="rc-container relative py-12 sm:py-16 lg:py-20">
        <p class="rc-eyebrow text-frost-200">Técnico até você</p>
        <h1 class="rc-relief mt-3 text-4xl leading-tight font-extrabold sm:text-5xl">Serviços</h1>
        <p class="mt-4 max-w-2xl text-lg text-castro-100">
          Conte o que aconteceu, mande fotos e escolha os dias que ficam bons para você. A loja confirma o
          técnico e o horário.
        </p>
      </div>
    </section>

    <section class="rc-container py-10 sm:py-14" aria-labelledby="tipos-titulo">
      <h2 id="tipos-titulo" class="sr-only">Tipos de serviço</h2>

      <div v-if="status === 'pending'" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="status">
        <span class="sr-only">Carregando serviços…</span>
        <BaseSkeleton v-for="n in 6" :key="n" class="h-96 w-full rounded-xl" />
      </div>

      <ErrorState v-else-if="status === 'error'" kind="server" :heading-level="2" @retry="refresh()" />

      <BaseEmptyState
        v-else-if="types.length === 0"
        title="Nenhum serviço disponível agora"
        :text="`Ligue para a loja no ${STORE_INFO.phone} que a gente ajuda.`"
      />

      <ul v-else class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="type in types" :key="type.id" :data-service="type.id">
          <article
            class="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-shadow hover:shadow-md"
          >
            <div class="bg-info-soft/60 px-6 pt-6">
              <img
                :src="serviceIllustration(type.name)"
                alt=""
                width="400"
                height="400"
                loading="lazy"
                class="mx-auto aspect-square h-44 w-auto sm:h-48"
              />
            </div>
            <div class="flex flex-1 flex-col gap-2 p-5">
              <h3 class="text-xl font-bold text-text">{{ type.name }}</h3>
              <p class="flex-1 text-text-muted">{{ type.description }}</p>
              <p class="inline-flex items-center gap-1.5 text-sm text-text-muted">
                <Clock class="size-4" aria-hidden="true" />
                Duração estimada: {{ durationLabel(type.estimatedMinutes) }}
              </p>
              <div class="mt-3 flex flex-wrap gap-2">
                <BaseButton :to="`/agendar?servico=${type.id}`" :aria-label="`Agendar visita: ${type.name}`">
                  <CalendarPlus class="size-5" aria-hidden="true" />
                  Agendar visita
                </BaseButton>
                <BaseButton
                  variant="secondary"
                  :to="`/orcamento?servico=${type.id}`"
                  :aria-label="`Pedir orçamento: ${type.name}`"
                >
                  <ReceiptText class="size-5" aria-hidden="true" />
                  Pedir orçamento
                </BaseButton>
              </div>
            </div>
          </article>
        </li>
      </ul>

      <p class="mt-10 text-center text-text-muted">
        Prefere conversar? Ligue para
        <a :href="STORE_INFO.phoneHref" class="font-semibold text-link">{{ STORE_INFO.phone }}</a>
        · {{ STORE_INFO.hours }}.
      </p>
    </section>
  </div>
</template>
