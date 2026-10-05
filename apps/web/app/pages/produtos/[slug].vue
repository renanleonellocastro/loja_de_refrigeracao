<script setup lang="ts">
import { BadgeCheck, PackageCheck, PackageX, ShoppingCart, Store } from 'lucide-vue-next';
import { formatMoney } from '~/utils/masks';
import { STORE_INFO } from '~/utils/store';
import { countLabel } from '~/utils/catalog';

/** UC Consultar Produtos, detail (RF-20, D1): public and rendered on the server, with Product JSON-LD. */
const route = useRoute();
const api = useApi();
const cart = useCartStore();
const config = useRuntimeConfig();
const requestUrl = useRequestURL();

// Each product page is its own instance (NuxtPage keys by path), so the slug never changes here.
const slug = String(route.params.slug);

const { data: product, error } = await useAsyncData(`product-${slug}`, async () => {
  try {
    return await unwrap(api.GET('/api/v1/products/{id}', { params: { path: { id: slug } } }));
  } catch (caught) {
    // A malformed slug (400 or 422) is as missing as an unknown one.
    const status = toApiError(caught).status;
    throw createError({ statusCode: [400, 404, 422].includes(status) ? 404 : 500 });
  }
});

if (error.value) {
  const notFound = error.value.statusCode === 404;
  throw createError({
    statusCode: notFound ? 404 : 500,
    statusMessage: notFound ? 'Produto não encontrado' : 'Erro ao carregar o produto',
    fatal: true,
  });
}

/** Present from here on: a missing product already became the 404 page. */
const item = computed(() => product.value!);

const quantity = ref(1);
const adding = ref(false);
const inCart = computed(() => cart.quantityOf(item.value.id));
const canAdd = computed(() => item.value.stockAvailable - inCart.value > 0);

async function addToCart(): Promise<void> {
  adding.value = true;
  if (await cart.add(cartProductOf(item.value), quantity.value)) quantity.value = 1;
  adding.value = false;
}

const details = computed<DescriptionItem[]>(() => {
  const value = item.value;
  return [
    { term: 'Categoria', detail: value.categoryName },
    { term: 'Marca', detail: value.brand ?? 'Não informada' },
    { term: 'Modelo', detail: value.model ?? 'Não informado' },
    { term: 'Condição', detail: CONDITION_LABELS[value.condition] },
  ];
});

const title = computed(() => `${item.value.name} | Refrigeração Castro`);
const description = computed(() => {
  const value = item.value;
  const text = value.description.replace(/\s+/g, ' ').trim();
  const lead = `${value.name}${value.condition === 'USED' ? ' (usado e revisado)' : ''} por ${formatMoney(value.priceCents)}.`;
  return `${lead} ${text}`.slice(0, 160);
});
const cover = computed(() => item.value.images[0]);
const canonical = computed(() => `${requestUrl.origin}/produtos/${item.value.slug}`);

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogType: 'website',
  ogUrl: canonical,
  ogImage: computed(() =>
    cover.value ? mediaUrl(config.public.apiBase, cover.value.url) : `${useRequestURL().origin}/og-image.png`,
  ),
});

useHead({
  link: [{ rel: 'canonical', href: canonical }],
  script: [
    {
      type: 'application/ld+json',
      key: 'product-jsonld',
      innerHTML: computed(() => {
        const value = item.value;
        return JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: value.name,
          description: value.description,
          sku: String(value.id),
          ...(value.brand ? { brand: { '@type': 'Brand', name: value.brand } } : {}),
          ...(value.model ? { model: value.model } : {}),
          category: value.categoryName,
          image: value.images.map((image) => mediaUrl(config.public.apiBase, image.url)),
          offers: {
            '@type': 'Offer',
            url: canonical.value,
            priceCurrency: 'BRL',
            price: (value.priceCents / 100).toFixed(2),
            itemCondition:
              value.condition === 'NEW'
                ? 'https://schema.org/NewCondition'
                : 'https://schema.org/UsedCondition',
            availability: value.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            seller: { '@type': 'Organization', name: STORE_INFO.name },
          },
        }).replace(/</g, '\\u003c');
      }),
    },
  ],
});
</script>

<template>
  <div v-if="product" class="rc-container py-6 sm:py-10">
    <BaseBreadcrumbs
      :items="[
        { label: 'Início', to: '/' },
        { label: 'Produtos', to: '/produtos' },
        { label: item.categoryName, to: `/produtos?categoria=${item.categoryId}` },
        { label: item.name },
      ]"
    />

    <div class="mt-4 grid gap-8 lg:grid-cols-2 lg:gap-12">
      <CatalogGallery :images="item.images" :name="item.name" :class="{ 'opacity-60': !item.available }" />

      <div class="flex flex-col gap-5">
        <div>
          <div class="flex flex-wrap gap-2">
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold"
              :class="
                item.condition === 'NEW'
                  ? 'bg-info-soft text-on-info-soft'
                  : 'bg-warning-soft text-on-warning-soft'
              "
            >
              <BadgeCheck class="size-4" aria-hidden="true" />
              {{ item.condition === 'NEW' ? 'Novo' : 'Usado, revisado pela loja' }}
            </span>
          </div>
          <h1 class="mt-3 text-2xl font-extrabold text-text sm:text-3xl">{{ item.name }}</h1>
          <p v-if="item.brand || item.model" class="mt-1 text-text-muted">
            {{ [item.brand, item.model].filter(Boolean).join(' · ') }}
          </p>
        </div>

        <p class="text-4xl font-extrabold text-text tabular-nums">{{ formatMoney(item.priceCents) }}</p>

        <p
          v-if="item.available"
          class="flex items-center gap-2 font-semibold"
          :class="item.lowStock ? 'text-on-warning-soft' : 'text-success'"
        >
          <PackageCheck class="size-5" aria-hidden="true" />
          <template v-if="item.lowStock">
            Últimas unidades: {{ countLabel(item.stockAvailable, 'disponível', 'disponíveis') }}
          </template>
          <template v-else
            >Em estoque: {{ countLabel(item.stockAvailable, 'disponível', 'disponíveis') }}</template
          >
        </p>
        <p v-else class="flex items-center gap-2 font-semibold text-text-muted">
          <PackageX class="size-5" aria-hidden="true" />
          Indisponível no momento
        </p>

        <div v-if="item.available" class="flex flex-wrap items-center gap-3">
          <CatalogQuantityStepper
            v-model="quantity"
            :max="Math.max(item.stockAvailable - inCart, 1)"
            :disabled="!canAdd"
          />
          <BaseButton
            size="lg"
            class="flex-1 sm:flex-none"
            :loading="adding"
            :disabled="!canAdd"
            @click="addToCart"
          >
            <ShoppingCart class="size-5" aria-hidden="true" />
            Adicionar ao carrinho
          </BaseButton>
        </div>
        <p v-if="inCart > 0" class="text-sm text-text-muted">
          Você tem {{ countLabel(inCart, 'unidade', 'unidades') }} no carrinho.
          <NuxtLink to="/carrinho" class="font-semibold text-link underline-offset-2 hover:underline">
            Ver carrinho
          </NuxtLink>
        </p>
        <BaseAlert v-if="!item.available" tone="info">
          Quer saber quando chega? Fale com a gente pelo WhatsApp ou pelo telefone {{ STORE_INFO.phone }}.
        </BaseAlert>

        <div class="flex items-start gap-3 rounded-lg bg-surface-sunken p-4 text-sm text-text-muted">
          <Store class="mt-0.5 size-5 shrink-0 text-link" aria-hidden="true" />
          <p>
            Reserve pelo site e retire na loja, na {{ STORE_INFO.street }}, {{ STORE_INFO.city }}. O pagamento
            é feito na retirada.
          </p>
        </div>

        <BaseDescriptionList :items="details" :columns="2" />
      </div>
    </div>

    <section v-if="item.description" class="mt-10 max-w-3xl" aria-labelledby="descricao-titulo">
      <h2 id="descricao-titulo" class="text-xl font-bold text-text">Descrição</h2>
      <p class="mt-3 whitespace-pre-line text-text-muted">{{ item.description }}</p>
    </section>
  </div>
</template>
