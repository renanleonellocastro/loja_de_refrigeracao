<script setup lang="ts">
import { Mail, MapPin, MessageCircle, Phone } from 'lucide-vue-next';
import { useLocalBusinessJsonLd } from '~/utils/seo';
import { cityLine, phoneHref, phoneLabel, streetLine, whatsappHref } from '~/utils/store';

/** Contact (RF-37): address, phone, email, WhatsApp, hours and map, all from the store settings. */
usePageSeo({
  title: 'Contato e localização | Refrigeração Castro',
  description:
    'Endereço, telefone, email e horário de funcionamento da Refrigeração Castro, na Rua Doutor Ulhoa Cintra, Centro de Mogi Mirim.',
  path: '/contato',
});

const store = useStoreInfo();
useLocalBusinessJsonLd(store);
</script>

<template>
  <div>
    <section class="rc-wall relative overflow-hidden">
      <FrostLines class="pointer-events-none absolute -right-24 bottom-4 w-[40rem] text-frost-300/30" />
      <div class="rc-container relative py-12 sm:py-16 lg:py-20">
        <p class="rc-eyebrow text-frost-200">Fale com a gente</p>
        <h1 class="rc-relief mt-3 text-4xl leading-tight font-extrabold sm:text-5xl">Contato</h1>
        <p class="mt-4 max-w-2xl text-lg text-castro-100">
          Passe na loja, ligue ou mande um email. A gente responde em até 1 dia útil.
        </p>
      </div>
    </section>

    <section class="rc-container grid gap-10 py-12 sm:py-16 lg:grid-cols-2 lg:items-start">
      <div class="flex flex-col gap-8">
        <div>
          <h2 class="text-2xl font-extrabold text-text">Endereço</h2>
          <address class="mt-3 flex items-start gap-2.5 text-lg text-text not-italic">
            <MapPin class="mt-1 size-5 shrink-0 text-link" aria-hidden="true" />
            <span>
              {{ streetLine(store.address) }}<br />
              {{ cityLine(store.address) }}
            </span>
          </address>
        </div>

        <div>
          <h2 class="text-2xl font-extrabold text-text">Telefone e email</h2>
          <ul class="mt-3 flex flex-col gap-1 text-lg">
            <li>
              <a
                :href="phoneHref(store.phone)"
                class="inline-flex min-h-11 items-center gap-2.5 font-semibold text-text hover:underline"
                data-testid="contact-phone"
              >
                <Phone class="size-5 text-link" aria-hidden="true" />
                {{ phoneLabel(store.phone) }}
              </a>
            </li>
            <li>
              <a
                :href="`mailto:${store.email}`"
                class="inline-flex min-h-11 items-center gap-2.5 break-all text-text hover:underline"
              >
                <Mail class="size-5 shrink-0 text-link" aria-hidden="true" />
                {{ store.email }}
              </a>
            </li>
            <li v-if="store.whatsapp">
              <a
                :href="whatsappHref(store.whatsapp)"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex min-h-11 items-center gap-2.5 font-semibold text-text hover:underline"
              >
                <MessageCircle class="size-5 text-link" aria-hidden="true" />
                WhatsApp {{ phoneLabel(store.whatsapp) }}
                <span class="sr-only">(abre em nova aba)</span>
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 class="text-2xl font-extrabold text-text">Horário de funcionamento</h2>
          <StoreHours :store="store" class="mt-3" />
        </div>
      </div>

      <div>
        <h2 class="sr-only">Mapa</h2>
        <StoreMap :store="store" />
      </div>
    </section>
  </div>
</template>
