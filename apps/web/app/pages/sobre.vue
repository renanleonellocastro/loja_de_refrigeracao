<script setup lang="ts">
import { CalendarPlus, ReceiptText } from 'lucide-vue-next';
import { cityLine, streetLine } from '~/utils/store';

/** About the store (RF-37): the history of docs/LOJA.md with the real storefront photo. */
usePageSeo({
  title: 'Sobre a loja | Refrigeração Castro',
  description:
    'A Refrigeração Castro foi fundada em Mogi Mirim pelos três irmãos Castro e está no mercado há mais de 40 anos. Hoje a loja é de Eduardo Castro.',
  path: '/sobre',
});

const store = useStoreInfo();

const FACTS = [
  { value: '40+', label: 'anos no mercado' },
  { value: '3', label: 'irmãos fundadores' },
  { value: '1', label: 'loja, em Mogi Mirim' },
];
</script>

<template>
  <div>
    <section class="rc-wall relative overflow-hidden">
      <FrostLines class="pointer-events-none absolute -right-24 bottom-4 w-[40rem] text-frost-300/30" />
      <div class="rc-container relative py-12 sm:py-16 lg:py-20">
        <p class="rc-eyebrow text-frost-200">Nossa história</p>
        <h1 class="rc-relief mt-3 text-4xl leading-tight font-extrabold sm:text-5xl">Sobre a loja</h1>
        <p class="mt-4 max-w-2xl text-lg text-castro-100">
          Uma loja de família que cuida do frio de Mogi Mirim há mais de 40 anos.
        </p>
      </div>
    </section>

    <section class="rc-container grid gap-10 py-12 sm:py-16 lg:grid-cols-2 lg:items-center">
      <div class="flex flex-col gap-4 text-lg leading-relaxed text-text">
        <h2 class="text-3xl font-extrabold">Feita pelos irmãos Castro</h2>
        <p>
          A Refrigeração Castro foi fundada em Mogi Mirim pelos três irmãos Castro e está no mercado há mais
          de 40 anos. Com o tempo, cada irmão seguiu com a sua própria refrigeração, de forma independente.
        </p>
        <p>
          Esta é a loja de <strong>Eduardo Castro</strong>, na {{ streetLine(store.address) }}, no
          {{ store.address.district }}. Ela não tem vínculo com as outras refrigerações da família: é aqui que
          você encontra o nosso balcão, a nossa oficina e a nossa equipe.
        </p>
        <p>
          Consertamos geladeiras, freezers, lavadoras e bebedouros, instalamos e cuidamos de ar condicionado e
          atendemos refrigeração comercial. Também vendemos eletrodomésticos novos e usados revisados.
        </p>
      </div>
      <figure class="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <NuxtPicture
          src="/brand/fachada-foto.jpg"
          format="avif,webp"
          sizes="100vw lg:640px"
          width="1920"
          height="944"
          loading="lazy"
          :img-attrs="{
            alt: 'Fachada azul da Refrigeração Castro com o letreiro prateado',
            class: 'block h-auto w-full',
          }"
        />
        <figcaption class="px-4 py-3 text-sm text-text-muted">
          A nossa fachada: {{ streetLine(store.address) }}, {{ cityLine(store.address) }}.
        </figcaption>
      </figure>
    </section>

    <section class="bg-surface-sunken py-12 sm:py-16" aria-labelledby="numeros-titulo">
      <div class="rc-container">
        <h2 id="numeros-titulo" class="sr-only">A Castro em números</h2>
        <dl class="grid gap-4 sm:grid-cols-3">
          <div
            v-for="fact in FACTS"
            :key="fact.label"
            class="flex flex-col rounded-xl border border-border bg-surface p-6 text-center shadow-sm"
          >
            <dt class="text-text-muted">{{ fact.label }}</dt>
            <dd class="order-first text-4xl font-extrabold text-link">{{ fact.value }}</dd>
          </div>
        </dl>
        <div class="mt-10 flex flex-wrap justify-center gap-3">
          <BaseButton to="/agendar">
            <CalendarPlus class="size-5" aria-hidden="true" />
            Agendar visita
          </BaseButton>
          <BaseButton to="/orcamento" variant="secondary">
            <ReceiptText class="size-5" aria-hidden="true" />
            Pedir orçamento
          </BaseButton>
        </div>
      </div>
    </section>
  </div>
</template>
