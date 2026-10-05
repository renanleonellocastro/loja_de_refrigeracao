<script setup lang="ts">
import {
  ArrowRight,
  BadgeCheck,
  CalendarPlus,
  Mail,
  Phone,
  ReceiptText,
  Truck,
  Users,
} from 'lucide-vue-next';
import { serviceIllustration } from '~/utils/service-requests';
import { phoneHref, phoneLabel, whatsappHref } from '~/utils/store';
import { useLocalBusinessJsonLd } from '~/utils/seo';

/** Home page (RF-36): the storefront, services, featured products, why Castro and how to find the store. */
usePageSeo({
  title: 'Refrigeração Castro | Conserto de geladeira e ar condicionado em Mogi Mirim',
  description:
    'Há mais de 40 anos em Mogi Mirim: conserto de geladeiras, freezers, lavadoras e bebedouros, instalação de ar condicionado e produtos novos e usados revisados.',
  path: '/',
});

// The hero illustration is the largest element of the first paint: preload the variant of the device.
useHead({
  link: [
    {
      rel: 'preload',
      as: 'image',
      href: '/illustrations/fachada-mobile.svg',
      media: '(max-width: 767px)',
      fetchpriority: 'high',
    },
    {
      rel: 'preload',
      as: 'image',
      href: '/illustrations/fachada-hero.svg',
      media: '(min-width: 768px)',
      fetchpriority: 'high',
    },
  ],
});

const api = useApi();
const store = useStoreInfo();
useLocalBusinessJsonLd(store);

const FEATURED_COUNT = 4;

const [{ data: serviceTypes }, { data: featured }] = await Promise.all([
  useAsyncData('home-services', () => unwrap(api.GET('/api/v1/service-types')).catch(() => [])),
  useAsyncData('home-products', () =>
    unwrap(
      api.GET('/api/v1/products', {
        params: { query: { available: 'true', sort: 'newest', pageSize: FEATURED_COUNT } },
      }),
    )
      .then((page) => page.data)
      .catch(() => []),
  ),
]);

const services = computed(() => (serviceTypes.value ?? []).filter((type) => type.active).slice(0, 6));
const products = computed(() => featured.value ?? []);

const REASONS = [
  {
    icon: Users,
    title: 'Empresa de família',
    text: 'Fundada pelos irmãos Castro e tocada hoje por Eduardo Castro, com atendimento de balcão.',
  },
  {
    icon: BadgeCheck,
    title: 'Há mais de 40 anos',
    text: 'Gerações de clientes em Mogi Mirim confiam o frio da casa e do comércio à Castro.',
  },
  {
    icon: Truck,
    title: 'Técnico vai até você',
    text: 'Conte o problema, escolha os dias que ficam bons e o técnico vai até a sua casa.',
  },
  {
    icon: ReceiptText,
    title: 'Novos e usados revisados',
    text: 'Geladeiras, lavadoras e bebedouros novos ou usados, revisados pela nossa oficina.',
  },
];
</script>

<template>
  <div>
    <section
      class="rc-wall relative flex flex-col overflow-hidden md:h-[clamp(30rem,52vw,46rem)]"
      aria-labelledby="inicio-titulo"
      data-testid="hero"
    >
      <div class="rc-container relative z-10 py-10 sm:py-14 md:flex md:h-full md:flex-col md:justify-center">
        <div class="max-w-xl md:max-w-[min(36rem,42vw)]">
          <p class="rc-eyebrow text-frost-200">Mogi Mirim/SP · há mais de 40 anos</p>
          <h1
            id="inicio-titulo"
            class="rc-relief mt-3 text-[2.5rem] leading-[1.05] font-extrabold sm:text-6xl lg:text-7xl"
          >
            Refrigeração Castro
          </h1>
          <p class="mt-4 text-lg text-castro-100 sm:text-xl">
            Conserto, instalação e venda de refrigeração, com atendimento de balcão e técnico que vai até
            você.
          </p>
          <div class="mt-7 flex flex-wrap gap-3">
            <NuxtLink
              to="/agendar"
              class="inline-flex h-13 items-center gap-2 rounded-md bg-white px-6 font-semibold text-castro-800 shadow-md transition-transform duration-200 hover:-translate-y-0.5"
            >
              <CalendarPlus class="size-5" aria-hidden="true" />
              Agendar visita
            </NuxtLink>
            <NuxtLink
              to="/orcamento"
              class="inline-flex h-13 items-center gap-2 rounded-md bg-castro-900/40 px-6 font-semibold text-white ring-1 ring-white/50 transition-colors hover:bg-white/10"
            >
              <ReceiptText class="size-5" aria-hidden="true" />
              Pedir orçamento
            </NuxtLink>
          </div>
        </div>
      </div>
      <picture class="block md:absolute md:inset-0">
        <source
          media="(min-width: 768px)"
          srcset="/illustrations/fachada-hero.svg"
          width="1600"
          height="900"
        />
        <img
          src="/illustrations/fachada-mobile.svg"
          width="900"
          height="1100"
          alt="Ilustração da fachada azul da loja com o letreiro Refrigeração Castro"
          fetchpriority="high"
          decoding="async"
          class="block h-auto w-full md:size-full md:object-cover md:object-right"
        />
      </picture>
    </section>

    <section class="rc-container py-14 sm:py-20" aria-labelledby="servicos-titulo">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="rc-eyebrow text-link">O que fazemos</p>
          <h2 id="servicos-titulo" class="mt-2 text-3xl font-extrabold text-text sm:text-4xl">
            Serviços de confiança
          </h2>
        </div>
        <NuxtLink to="/servicos" class="inline-flex min-h-11 items-center gap-1 font-semibold text-link">
          Ver todos os serviços
          <ArrowRight class="size-4" aria-hidden="true" />
        </NuxtLink>
      </div>
      <ul v-if="services.length > 0" class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="service in services" :key="service.id" data-home-service>
          <article
            class="relative flex h-full items-center gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-primary/40 hover:shadow-md"
          >
            <img
              :src="serviceIllustration(service.name)"
              alt=""
              width="400"
              height="400"
              loading="lazy"
              class="size-20 shrink-0 rounded-lg bg-info-soft/60"
            />
            <div>
              <h3 class="text-lg font-bold text-text">
                <NuxtLink
                  :to="`/agendar?servico=${service.id}`"
                  class="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-focus"
                >
                  {{ service.name }}
                </NuxtLink>
              </h3>
              <p class="mt-1 line-clamp-2 text-text-muted">{{ service.description }}</p>
            </div>
          </article>
        </li>
      </ul>
      <p v-else class="mt-6 text-text-muted">
        Conserto de geladeiras, freezers, lavadoras e bebedouros, instalação e manutenção de ar condicionado.
        <NuxtLink to="/servicos" class="font-semibold text-link">Conheça os serviços</NuxtLink>.
      </p>
    </section>

    <section
      v-if="products.length > 0"
      class="bg-surface-sunken py-14 sm:py-20"
      aria-labelledby="produtos-titulo"
    >
      <div class="rc-container">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p class="rc-eyebrow text-link">Na loja</p>
            <h2 id="produtos-titulo" class="mt-2 text-3xl font-extrabold text-text sm:text-4xl">
              Produtos em destaque
            </h2>
          </div>
          <NuxtLink to="/produtos" class="inline-flex min-h-11 items-center gap-1 font-semibold text-link">
            Ver todos os produtos
            <ArrowRight class="size-4" aria-hidden="true" />
          </NuxtLink>
        </div>
        <ul class="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <li v-for="product in products" :key="product.id">
            <LazyCatalogProductCard hydrate-on-visible :product="product" :heading-level="3" />
          </li>
        </ul>
      </div>
    </section>

    <section class="rc-container py-14 sm:py-20" aria-labelledby="porque-titulo">
      <p class="rc-eyebrow text-link">Por que a Castro</p>
      <h2 id="porque-titulo" class="mt-2 text-3xl font-extrabold text-text sm:text-4xl">
        Loja de bairro, oficina de verdade
      </h2>
      <ul class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <li v-for="reason in REASONS" :key="reason.title">
          <BaseCard class="h-full">
            <span class="flex size-12 items-center justify-center rounded-lg bg-info-soft text-on-info-soft">
              <component :is="reason.icon" class="size-6" aria-hidden="true" />
            </span>
            <h3 class="mt-4 text-lg font-bold text-text">{{ reason.title }}</h3>
            <p class="mt-1 text-text-muted">{{ reason.text }}</p>
          </BaseCard>
        </li>
      </ul>
      <NuxtLink to="/sobre" class="mt-6 inline-flex min-h-11 items-center gap-1 font-semibold text-link">
        Conheça a nossa história
        <ArrowRight class="size-4" aria-hidden="true" />
      </NuxtLink>
    </section>

    <section class="border-t border-border py-14 sm:py-20" aria-labelledby="visite-titulo">
      <div class="rc-container grid gap-8 lg:grid-cols-2 lg:items-start">
        <div>
          <p class="rc-eyebrow text-link">Visite a loja</p>
          <h2 id="visite-titulo" class="mt-2 text-3xl font-extrabold text-text sm:text-4xl">Onde estamos</h2>
          <LazyStoreHours hydrate-on-visible :store="store" class="mt-6" />
          <ul class="mt-6 flex flex-col gap-2">
            <li>
              <a
                :href="phoneHref(store.phone)"
                class="inline-flex min-h-11 items-center gap-2.5 font-semibold text-text hover:underline"
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
                Conversar pelo WhatsApp
                <span class="sr-only">(abre em nova aba)</span>
              </a>
            </li>
          </ul>
        </div>
        <LazyStoreMap hydrate-on-visible :store="store" />
      </div>
    </section>
  </div>
</template>
