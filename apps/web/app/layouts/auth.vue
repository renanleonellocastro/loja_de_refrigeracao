<script setup lang="ts">
import { STORE_INFO } from '~/utils/store';
import { CalendarCheck, MapPin, Package, Phone, ReceiptText } from 'lucide-vue-next';

/**
 * Account screens (sign in, registration, passwords): the storefront wall beside the form on desktops,
 * a blue band with the sign above a raised card on phones and tablets.
 */
const PERKS = [
  { icon: Package, text: 'Acompanhe seus pedidos até a retirada na loja' },
  { icon: CalendarCheck, text: 'Peça visita técnica e converse com a loja pelo site' },
  { icon: ReceiptText, text: 'Receba e aprove orçamentos sem precisar ligar' },
];
</script>

<template>
  <div class="min-h-dvh bg-bg lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
    <LayoutSkipLink />
    <aside
      class="rc-wall relative overflow-hidden px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-20 md:px-8 md:pb-32 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:p-12 xl:p-16"
    >
      <FrostLines
        class="pointer-events-none absolute -right-24 bottom-4 w-[38rem] text-frost-300/25 lg:-right-16 lg:bottom-24"
      />
      <NuxtLink
        to="/"
        class="relative inline-flex h-12 items-center rounded-md md:h-14"
        aria-label="Refrigeração Castro, página inicial"
      >
        <AppLogo relief class="h-9 md:h-11 lg:h-12" aria-hidden="true" />
      </NuxtLink>

      <div class="relative mt-auto hidden max-w-md lg:block">
        <p class="rc-eyebrow text-frost-200">Mogi Mirim/SP · desde {{ STORE_INFO.since }}</p>
        <p class="rc-relief mt-4 font-display text-5xl leading-[1.05] font-extrabold xl:text-6xl">
          Seu frio em boas mãos.
        </p>
        <ul class="mt-8 flex flex-col gap-4 text-lg text-castro-100">
          <li v-for="perk in PERKS" :key="perk.text" class="flex items-start gap-3">
            <span class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-white/10">
              <component :is="perk.icon" class="size-5 text-frost-200" aria-hidden="true" />
            </span>
            {{ perk.text }}
          </li>
        </ul>
      </div>

      <div class="relative mt-auto hidden flex-col gap-2 pt-10 text-sm text-castro-200 lg:flex">
        <a :href="STORE_INFO.phoneHref" class="inline-flex items-center gap-2 hover:text-white">
          <Phone class="size-4" aria-hidden="true" />
          {{ STORE_INFO.phone }}
        </a>
        <p class="inline-flex items-center gap-2">
          <MapPin class="size-4" aria-hidden="true" />
          {{ STORE_INFO.street }}, {{ STORE_INFO.city }}
        </p>
      </div>
    </aside>

    <div class="relative -mt-12 px-4 pb-10 md:-mt-20 md:px-8 lg:mt-0 lg:flex lg:flex-col lg:px-12 lg:py-10">
      <main
        id="conteudo"
        tabindex="-1"
        class="mx-auto w-full max-w-lg rounded-xl border border-border bg-surface p-5 shadow-lg outline-none sm:p-8 lg:my-auto lg:max-w-md lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
      >
        <slot />
      </main>
      <footer
        class="mx-auto mt-8 flex max-w-lg flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-text-muted"
      >
        <NuxtLink to="/" class="inline-flex min-h-11 items-center hover:text-link">Voltar ao site</NuxtLink>
        <NuxtLink to="/privacidade" class="inline-flex min-h-11 items-center hover:text-link">
          Política de privacidade
        </NuxtLink>
        <ThemeToggle />
      </footer>
    </div>
  </div>
</template>
