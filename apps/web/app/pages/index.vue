<script setup lang="ts">
import { STORE_INFO } from '~/utils/store';
import { AirVent, ArrowRight, Refrigerator, WashingMachine } from 'lucide-vue-next';

useSeoMeta({ title: 'Refrigeração Castro | Mogi Mirim' });

// A first taste of the home page; the full version with products and map comes in milestone M9.
const SERVICES = [
  { icon: Refrigerator, title: 'Geladeiras e freezers', text: 'Conserto com peça original e garantia.' },
  { icon: AirVent, title: 'Ar condicionado', text: 'Instalação, limpeza e manutenção.' },
  { icon: WashingMachine, title: 'Lavadoras', text: 'Diagnóstico rápido no balcão ou em casa.' },
];
</script>

<template>
  <div>
    <section class="rc-wall relative overflow-hidden">
      <FrostLines class="pointer-events-none absolute -right-24 bottom-6 w-[44rem] text-frost-300/30" />
      <div class="rc-container relative py-16 sm:py-24 lg:py-28">
        <p class="rc-eyebrow text-frost-200">Mogi Mirim/SP · desde {{ STORE_INFO.since }}</p>
        <h1 class="rc-relief mt-4 text-[2.5rem] leading-[1.05] font-extrabold sm:text-6xl lg:text-7xl">
          Refrigeração Castro
        </h1>
        <p class="mt-5 max-w-xl text-lg text-castro-100 sm:text-xl">
          Há mais de 40 anos cuidando do seu frio, com atendimento de balcão e técnico que vai até você.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <NuxtLink
            to="/orcamento"
            class="inline-flex h-13 items-center gap-2 rounded-md bg-white px-6 font-semibold text-castro-800 shadow-md transition-transform duration-200 hover:-translate-y-0.5"
          >
            Pedir orçamento
            <ArrowRight class="size-5" aria-hidden="true" />
          </NuxtLink>
          <NuxtLink
            to="/produtos"
            class="inline-flex h-13 items-center rounded-md px-6 font-semibold text-white ring-1 ring-white/40 transition-colors hover:bg-white/10"
          >
            Ver produtos
          </NuxtLink>
        </div>
      </div>
    </section>

    <section class="rc-container py-14 sm:py-20" aria-labelledby="servicos-titulo">
      <p class="rc-eyebrow text-link">O que fazemos</p>
      <h2 id="servicos-titulo" class="mt-2 text-3xl font-extrabold text-text sm:text-4xl">
        Serviços de confiança
      </h2>
      <ul class="mt-8 grid gap-4 sm:grid-cols-3">
        <li v-for="service in SERVICES" :key="service.title">
          <BaseCard interactive>
            <span class="flex size-12 items-center justify-center rounded-lg bg-info-soft text-on-info-soft">
              <component :is="service.icon" class="size-6" aria-hidden="true" />
            </span>
            <h3 class="mt-4 text-lg font-bold text-text">{{ service.title }}</h3>
            <p class="mt-1 text-text-muted">{{ service.text }}</p>
          </BaseCard>
        </li>
      </ul>
    </section>
  </div>
</template>
