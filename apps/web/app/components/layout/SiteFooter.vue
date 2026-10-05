<script setup lang="ts">
import { formatCnpj } from '~/utils/masks';
import {
  cityLine,
  mapsSearchUrl,
  openingHoursSummary,
  phoneHref,
  phoneLabel,
  PUBLIC_NAV,
  streetLine,
} from '~/utils/store';
import { Clock, Mail, MapPin, Phone } from 'lucide-vue-next';

const store = useStoreInfo();

const LINKS = [
  ...PUBLIC_NAV.slice(1),
  { label: 'Pedir orçamento', to: '/orcamento' },
  { label: 'Política de privacidade', to: '/privacidade' },
];
</script>

<template>
  <footer class="relative overflow-hidden bg-castro-900 text-castro-100">
    <FrostLines class="pointer-events-none absolute -top-6 right-0 w-[36rem] max-w-full text-frost-400/25" />
    <div
      class="rc-container relative grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1.15fr_0.8fr] lg:py-16"
    >
      <div class="flex flex-col gap-4">
        <AppLogo relief class="h-11 self-start" />
        <p class="max-w-xs text-[0.9375rem] leading-relaxed">
          Conserto, instalação e venda de refrigeração em Mogi Mirim. Atendimento de balcão, com nome e
          sobrenome.
        </p>
        <p
          class="inline-flex items-center gap-2 self-start rounded-full border border-white/15 bg-white/5 px-3 py-1 rc-eyebrow text-white"
        >
          <span class="size-1.5 rounded-full bg-frost-300" aria-hidden="true" />
          Há mais de 40 anos em Mogi Mirim
        </p>
      </div>

      <div>
        <h2 class="rc-eyebrow font-sans text-white">Visite a loja</h2>
        <address class="mt-4 flex flex-col gap-3 text-[0.9375rem] not-italic">
          <a
            :href="mapsSearchUrl(store.address)"
            target="_blank"
            rel="noopener noreferrer"
            class="group flex items-start gap-2.5 hover:text-white"
          >
            <MapPin class="mt-0.5 size-4.5 shrink-0 text-frost-300" aria-hidden="true" />
            <span>
              {{ streetLine(store.address) }}<br />
              {{ cityLine(store.address) }}
              <span class="sr-only">(abre o mapa em nova aba)</span>
            </span>
          </a>
          <p class="flex items-start gap-2.5">
            <Clock class="mt-0.5 size-4.5 shrink-0 text-frost-300" aria-hidden="true" />
            {{ openingHoursSummary(store.openingHours) }}
          </p>
        </address>
      </div>

      <div>
        <h2 class="rc-eyebrow font-sans text-white">Fale com a gente</h2>
        <ul class="mt-4 flex flex-col gap-3 text-[0.9375rem]">
          <li>
            <a
              :href="phoneHref(store.phone)"
              class="flex items-center gap-2.5 font-semibold text-white hover:underline"
            >
              <Phone class="size-4.5 text-frost-300" aria-hidden="true" />
              {{ phoneLabel(store.phone) }}
            </a>
          </li>
          <li>
            <a :href="`mailto:${store.email}`" class="flex items-center gap-2.5 break-words hover:text-white">
              <Mail class="size-4.5 shrink-0 text-frost-300" aria-hidden="true" />
              {{ store.email }}
            </a>
          </li>
        </ul>
      </div>

      <nav aria-label="Rodapé">
        <h2 class="rc-eyebrow font-sans text-white">Navegue</h2>
        <ul class="mt-2 grid grid-cols-2 gap-x-4 md:grid-cols-1">
          <li v-for="link in LINKS" :key="link.to">
            <NuxtLink
              :to="link.to"
              class="inline-flex min-h-11 items-center text-[0.9375rem] hover:text-white hover:underline"
            >
              {{ link.label }}
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </div>

    <div class="border-t border-white/10">
      <div
        class="rc-container flex flex-col gap-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-sm md:flex-row md:items-center md:justify-between md:pr-48 md:pb-6"
      >
        <p>© {{ store.legalName }} · CNPJ {{ formatCnpj(store.cnpj) }}</p>
        <ThemeToggle tone="brand" />
      </div>
    </div>
  </footer>
</template>
