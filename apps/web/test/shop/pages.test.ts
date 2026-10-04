import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToast } from '~/composables/useToast';
import CartPage from '~/pages/carrinho/index.vue';
import CheckoutPage from '~/pages/carrinho/finalizar.vue';
import PlacedPage from '~/pages/carrinho/pedido/[id].vue';
import OrderPage from '~/pages/minha-conta/pedidos/[id].vue';
import OrdersPage from '~/pages/minha-conta/pedidos/index.vue';
import CatalogPage from '~/pages/produtos/index.vue';
import ProductPage from '~/pages/produtos/[slug].vue';
import { useAuthStore } from '~/stores/auth';
import { useCartStore } from '~/stores/cart';
import { click, mockApi, problem, session } from '../support/api';
import { FACETS, cart, detail, guestCart, order, orderList, orderListItem, product } from '../support/shop';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));
mockNuxtImport('navigateTo', () => navigateMock);

const PRODUCTS = 'GET /api/v1/products';
const FACETS_KEY = 'GET /api/v1/products/facets';
const CART = 'GET /api/v1/me/cart';
const ORDERS = 'POST /api/v1/orders';

/** Lets API answers and router navigations finish. */
async function settle(): Promise<void> {
  await flushPromises();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await flushPromises();
}

const toastTitles = () => useToast().toasts.value.map((toast) => toast.title);
const page = (data: unknown[], total = data.length) => ({
  body: { data, meta: { page: 1, pageSize: 24, total } },
});
const buttonByText = (text: string) =>
  [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === text);

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  useAuthStore().clear();
  await settle();
  const store = useCartStore();
  store.guest = [];
  store.server = null;
  store.loaded = false;
  useToast().clear();
  navigateMock.mockReset();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('catalog page', () => {
  it('lists products, searches, filters, sorts and paginates through the address', async () => {
    const api = mockApi()
      .on(PRODUCTS, page([product(), product({ id: 2, slug: 'b', available: false })], 50))
      .on(FACETS_KEY, { body: FACETS });
    const wrapper = await mountSuspended(CatalogPage, { route: '/produtos', attachTo: document.body });
    await settle();
    const router = useRouter();
    expect(wrapper.get('h1').text()).toBe('Produtos');
    expect(wrapper.text()).toContain('50 produtos encontrados');
    expect(wrapper.findAll('article')).toHaveLength(2);
    expect(api.called(PRODUCTS)[0]!.url.searchParams.get('pageSize')).toBe('24');
    expect(wrapper.findAll('option').map((option) => option.text())).not.toContain('Mais relevantes');

    await wrapper.get('input[type="search"]').setValue('  geladera ');
    await wrapper.get('form[role="search"]').trigger('submit');
    await settle();
    expect(router.currentRoute.value.fullPath).toBe('/produtos?q=geladera');
    expect(wrapper.get('h1').text()).toBe('Resultados para “geladera”');
    expect(wrapper.findAll('option').map((option) => option.text())).toContain('Mais relevantes');

    await wrapper.get('select').setValue('menor-preco');
    await settle();
    expect(router.currentRoute.value.query.ordem).toBe('menor-preco');

    await wrapper.findAll('input[name="lateral-categoria"]')[1]!.trigger('change');
    await settle();
    await wrapper.findAll('input[name="lateral-condicao"]')[1]!.trigger('change');
    await settle();
    await wrapper.findAll('input[name="lateral-marca"]')[1]!.trigger('change');
    await settle();
    expect(router.currentRoute.value.query).toMatchObject({
      categoria: '7',
      condicao: 'novo',
      marca: 'Embraco',
    });
    expect(wrapper.get('h1').text()).toBe('Resultados para “geladera”');
    expect(wrapper.text()).toContain('Filtros (3)');
    const chips = wrapper.get('ul[aria-label="Filtros ativos"]').findAll('button');
    expect(chips.map((chip) => chip.text())).toEqual([
      'Peças e acessórios , remover filtro',
      'Novo , remover filtro',
      'Embraco , remover filtro',
    ]);
    await chips[2]!.trigger('click');
    await settle();
    await wrapper.get('ul[aria-label="Filtros ativos"]').findAll('button')[1]!.trigger('click');
    await settle();
    await wrapper.get('ul[aria-label="Filtros ativos"]').findAll('button')[0]!.trigger('click');
    await settle();
    expect(router.currentRoute.value.query).toEqual({ q: 'geladera', ordem: 'menor-preco' });

    window.scrollTo = vi.fn();
    wrapper.findAll('nav[aria-label="Páginas de produtos"] button').at(-1)!.element.click();
    await settle();
    expect(router.currentRoute.value.query.pagina).toBe('2');
    expect(window.scrollTo).toHaveBeenCalled();

    // Phones open the filters in a sheet; clearing keeps the search.
    await router.push('/produtos?q=geladera&categoria=7&disponiveis=1');
    await settle();
    expect(wrapper.get('h1').text()).toBe('Resultados para “geladera”');
    click('Filtros (2)');
    await settle();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    buttonByText('Ver 50 produtos')!.click();
    await settle();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    click('Filtros (2)');
    await settle();
    (document.querySelector('[role="dialog"] button[aria-label="Fechar"]') as HTMLButtonElement).click();
    await settle();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    click('Filtros (2)');
    await settle();
    buttonByText('Limpar filtros')!.click();
    await settle();
    expect(router.currentRoute.value.fullPath).toBe('/produtos?q=geladera');
    wrapper.unmount();
  });

  it('names the category, shows empty results and errors', async () => {
    mockApi().on(PRODUCTS, page([])).on(FACETS_KEY, { body: FACETS });
    const wrapper = await mountSuspended(CatalogPage, { route: '/produtos?categoria=7&pagina=2' });
    await settle();
    expect(wrapper.get('h1').text()).toBe('Peças e acessórios');
    expect(wrapper.text()).toContain('Nenhum produto encontrado');
    expect(wrapper.find('a[href="/produtos"]').exists()).toBe(true);

    const plain = await mountSuspended(CatalogPage, { route: '/produtos?categoria=99' });
    await settle();
    expect(plain.get('h1').text()).toBe('Produtos');
    const unfiltered = await mountSuspended(CatalogPage, { route: '/produtos?ordem=nome' });
    await settle();
    expect(unfiltered.text()).not.toContain('Ver todos os produtos');

    mockApi().on(PRODUCTS, new TypeError('offline')).on(FACETS_KEY, { body: FACETS });
    const failed = await mountSuspended(CatalogPage, { route: '/produtos?q=x' });
    await settle();
    expect(failed.text()).toContain('Tentar de novo');
    mockApi()
      .on(PRODUCTS, page([product()]))
      .on(FACETS_KEY, { body: FACETS });
    await failed
      .findAll('button')
      .find((item) => item.text() === 'Tentar de novo')!
      .trigger('click');
    await settle();
    expect(failed.findAll('article')).toHaveLength(1);
  });

  it('shows skeletons while the first page loads', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    vi.stubGlobal('fetch', async (input: Request) => {
      await gate;
      const url = new URL(input.url);
      const body = url.pathname.endsWith('facets')
        ? FACETS
        : { data: [], meta: { page: 1, pageSize: 24, total: 0 } };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const pending = mountSuspended(CatalogPage, { route: '/produtos?q=lento' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    const wrapper = await pending;
    await settle();
    expect(wrapper.text()).toContain('Nenhum produto encontrado');
  });
});

describe('product page', () => {
  it('shows the product, adds to the cart and publishes JSON-LD', async () => {
    mockApi().on('GET /api/v1/products/compressor-embraco', { body: detail() });
    const wrapper = await mountSuspended(ProductPage, { route: '/produtos/compressor-embraco' });
    await settle();
    expect(wrapper.get('h1').text()).toBe('Compressor Embraco');
    expect(wrapper.text()).toContain('Embraco · EMIS30HHR');
    expect(wrapper.text()).toContain('Em estoque: 8 disponíveis');
    expect(wrapper.text()).toContain('Novo');
    const jsonLd = document.head.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(jsonLd!.innerHTML)).toMatchObject({
      '@type': 'Product',
      brand: { name: 'Embraco' },
      offers: { price: '499.00', availability: 'https://schema.org/InStock' },
    });
    await wrapper.get('button[aria-label="Aumentar quantidade"]').trigger('click');
    const add = wrapper.findAll('button').find((item) => item.text().includes('Adicionar ao carrinho'))!;
    await add.trigger('click');
    await settle();
    expect(useCartStore().quantityOf(14)).toBe(2);
    expect(wrapper.text()).toContain('Você tem 2 unidades no carrinho.');
    expect(wrapper.get('input[type="number"]').element.value).toBe('1');
    // Asking for more than what is left keeps the quantity picked.
    useCartStore().guest = guestCart(8, { stockAvailable: 8 });
    await settle();
    expect(add.attributes('disabled')).toBeDefined();
  });

  it('keeps the quantity when the API refuses it', async () => {
    mockApi()
      .on('GET /api/v1/products/compressor-embraco', { body: detail() })
      .on('PUT /api/v1/me/cart/items/14', problem(409, 'Temos 1 unidade(s) disponível(is).'));
    useAuthStore().apply(session());
    await settle();
    const wrapper = await mountSuspended(ProductPage, { route: '/produtos/compressor-embraco' });
    await settle();
    await wrapper.get('button[aria-label="Aumentar quantidade"]').trigger('click');
    await wrapper
      .findAll('button')
      .find((item) => item.text().includes('Adicionar ao carrinho'))!
      .trigger('click');
    await settle();
    expect(toastTitles()).toContain('Temos 1 unidade(s) disponível(is).');
    expect(wrapper.get('input[type="number"]').element.value).toBe('2');
  });

  it('describes used, low stock and unavailable products', async () => {
    mockApi()
      .on('GET /api/v1/products/usado', {
        body: detail({
          slug: 'usado',
          condition: 'USED',
          lowStock: true,
          stockAvailable: 1,
          brand: null,
          model: null,
          images: [],
          description: '',
        }),
      })
      .on('GET /api/v1/products/esgotado', {
        body: detail({ slug: 'esgotado', available: false, stockAvailable: 0, model: null }),
      });
    const used = await mountSuspended(ProductPage, { route: '/produtos/usado' });
    await settle();
    expect(used.text()).toContain('Usado, revisado pela loja');
    expect(used.text()).toContain('Últimas unidades: 1 disponível');
    expect(used.text()).not.toContain('Descrição');
    const ld = JSON.parse(document.head.querySelector('script[type="application/ld+json"]')!.innerHTML);
    expect(ld.brand).toBeUndefined();
    expect(ld.offers.itemCondition).toBe('https://schema.org/UsedCondition');
    const sold = await mountSuspended(ProductPage, { route: '/produtos/esgotado' });
    await settle();
    expect(sold.text()).toContain('Indisponível no momento');
    expect(sold.text()).not.toContain('Adicionar ao carrinho');
  });

  it('turns a missing product into the 404 page and other failures into 500', async () => {
    mockApi()
      .on('GET /api/v1/products/sumiu', problem(404, 'Produto não encontrado.'))
      .on('GET /api/v1/products/quebrou', problem(500, 'Erro'));
    const missing = await mountSuspended(ProductPage, { route: '/produtos/sumiu' });
    expect(missing.find('h1').exists()).toBe(false);
    const broken = await mountSuspended(ProductPage, { route: '/produtos/quebrou' });
    expect(broken.find('h1').exists()).toBe(false);
  });
});

describe('cart page', () => {
  it('shows the empty cart after loading', async () => {
    mockApi();
    const wrapper = await mountSuspended(CartPage, { route: '/carrinho' });
    expect(wrapper.text()).toContain('Carregando o carrinho');
    await settle();
    expect(wrapper.text()).toContain('Seu carrinho está vazio');
  });

  it('changes quantities, fixes problems and removes items', async () => {
    const api = mockApi()
      .on(CART, {
        body: cart([
          { quantity: 3, product: { stockAvailable: 2 }, problem: 'insufficient' },
          {
            quantity: 1,
            product: { id: 15, slug: 'esgotado', name: 'Esgotado', stockAvailable: 0 },
            problem: 'unavailable',
          },
        ]),
      })
      .on('PUT /api/v1/me/cart/items/14', { body: cart([{ quantity: 2, product: { stockAvailable: 2 } }]) })
      .on('DELETE /api/v1/me/cart/items/15', { body: cart([{ quantity: 2 }]) })
      .on('DELETE /api/v1/me/cart/items/14', { body: cart([]) });
    useAuthStore().apply(session());
    await settle();
    const wrapper = await mountSuspended(CartPage, { route: '/carrinho', attachTo: document.body });
    await settle();
    expect(wrapper.text()).toContain('Temos só 2 unidades disponíveis.');
    expect(wrapper.text()).toContain('Este produto esgotou.');
    expect(wrapper.text()).toContain('Resolva os itens marcados para continuar.');
    expect(wrapper.get('a[href="/carrinho/finalizar"]').attributes('aria-disabled')).toBe('true');
    click('Ajustar para 2');
    await settle();
    expect(api.called('PUT /api/v1/me/cart/items/14')[0]!.body).toEqual({ quantity: 2 });
    await wrapper.setProps({});
    expect(wrapper.text()).not.toContain('Ajustar para');
    mockApi()
      .on(CART, {
        body: cart([
          { quantity: 1, product: { id: 15, slug: 'esgotado', stockAvailable: 0 }, problem: 'unavailable' },
        ]),
      })
      .on('DELETE /api/v1/me/cart/items/15', { body: cart([{ quantity: 1 }]) })
      .on('PUT /api/v1/me/cart/items/14', { body: cart([{ quantity: 2 }]) })
      .on('DELETE /api/v1/me/cart/items/14', { body: cart([]) });
    await useCartStore().load();
    await settle();
    click('Tirar do carrinho');
    await settle();
    expect(wrapper.text()).toContain('R$ 499,00');
    await wrapper.get('button[aria-label="Aumentar quantidade"]').trigger('click');
    await settle();
    expect(useCartStore().count).toBe(2);
    await wrapper.get('button[aria-label="Remover Compressor Embraco"]').trigger('click');
    await settle();
    expect(wrapper.text()).toContain('Seu carrinho está vazio');
  });
});

describe('checkout page', () => {
  let keys: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    keys = vi.spyOn(crypto, 'randomUUID');
  });

  afterEach(() => {
    keys.mockRestore();
  });

  async function mountCheckout(lines: Parameters<typeof cart>[0]) {
    const api = mockApi().on(CART, { body: cart(lines) });
    useAuthStore().apply(session());
    await settle();
    const wrapper = await mountSuspended(CheckoutPage, {
      route: '/carrinho/finalizar',
      attachTo: document.body,
    });
    await settle();
    return { api, wrapper };
  }

  it('places the order with the notes and an idempotency key', async () => {
    const { api, wrapper } = await mountCheckout([{ quantity: 2 }]);
    api.on(ORDERS, { status: 201, body: order() });
    expect(wrapper.text()).toContain('Pagamento na retirada.');
    expect(wrapper.text()).toContain('2 × R$ 499,00');
    await wrapper.get('textarea').setValue('  Retiro na sexta. ');
    await wrapper.get('form').trigger('submit');
    await settle();
    expect(api.called(ORDERS)[0]!.body).toEqual({ notes: 'Retiro na sexta.' });
    expect(navigateMock).toHaveBeenCalledWith('/carrinho/pedido/31');
    expect(useCartStore().count).toBe(0);
  });

  it('shows items without stock and fixes them', async () => {
    const third = {
      quantity: 1,
      product: { id: 16, slug: 'c', name: 'Terceiro', stockAvailable: 0 },
      problem: 'unavailable' as const,
    };
    const { api, wrapper } = await mountCheckout([
      { quantity: 3 },
      { quantity: 1, product: { id: 15, slug: 'b', name: 'Outro' } },
      third,
    ]);
    api
      .on(
        ORDERS,
        problem(409, 'Alguns itens não têm a quantidade pedida disponível.', {
          code: 'insufficient-stock',
          items: [
            { productId: 14, requested: 3, available: 2 },
            { productId: 15, requested: 1, available: 0 },
          ],
        }),
        problem(409, 'Seu carrinho está vazio.', { code: 'cart-empty' }),
      )
      .on('PUT /api/v1/me/cart/items/14', problem(409, 'Mudou de novo.'), {
        body: cart([{ quantity: 2 }, { quantity: 1, product: { id: 15, slug: 'b', name: 'Outro' } }, third]),
      })
      .on('DELETE /api/v1/me/cart/items/15', { body: cart([{ quantity: 2 }, third]) })
      .on('DELETE /api/v1/me/cart/items/16', { body: cart([{ quantity: 2 }]) });
    expect(wrapper.text()).toContain('Este produto esgotou enquanto você comprava.');
    await wrapper.get('form').trigger('submit');
    await settle();
    // An answered attempt ends the key; the next attempt is a new request.
    expect(keys).toHaveBeenCalledTimes(2);
    expect(toastTitles()).toContain('Alguns itens não têm a quantidade pedida. Ajuste e tente de novo.');
    expect(wrapper.text()).toContain('Temos só 2 unidades disponíveis.');
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
    click('Ajustar para 2');
    await settle();
    expect(toastTitles()).toContain('Mudou de novo.');
    expect(wrapper.text()).toContain('Ajustar para 2');
    click('Ajustar para 2');
    await settle();
    expect(wrapper.text()).not.toContain('Ajustar para 2');
    click('Tirar do pedido');
    await settle();
    click('Tirar do pedido');
    await settle();
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined();
    await wrapper.get('form').trigger('submit');
    await settle();
    expect(api.called(ORDERS)[1]!.body).toEqual({});
    expect(toastTitles()).toContain('Seu carrinho está vazio.');
  });

  it('keeps the key after a dropped connection and handles a 409 without items', async () => {
    const { api, wrapper } = await mountCheckout([{ quantity: 1 }]);
    api.on(
      ORDERS,
      new TypeError('offline'),
      problem(409, 'Estoque insuficiente', { code: 'insufficient-stock' }),
    );
    await wrapper.get('form').trigger('submit');
    await settle();
    expect(toastTitles()).toContain(
      'Não conseguimos falar com a loja agora. Confira sua conexão e tente de novo.',
    );
    await wrapper.get('form').trigger('submit');
    await settle();
    expect(api.called(ORDERS)).toHaveLength(2);
    // Only the 409 answer renews the key; the dropped connection kept it for the retry.
    expect(keys).toHaveBeenCalledTimes(2);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('sends an empty cart back to the products', async () => {
    const { wrapper } = await mountCheckout([]);
    expect(wrapper.text()).toContain('Escolha os produtos primeiro');
  });

  it('shows skeletons before the cart loads', async () => {
    mockApi();
    const wrapper = await mountSuspended(CheckoutPage, { route: '/carrinho/finalizar' });
    expect(wrapper.text()).toContain('Carregando o pedido');
  });
});

describe('order placed page', () => {
  it('shows the number and retries a failed load', async () => {
    mockApi().on('GET /api/v1/orders/31', new TypeError('offline'), { body: order() });
    const wrapper = await mountSuspended(PlacedPage, {
      route: '/carrinho/pedido/31',
      attachTo: document.body,
    });
    expect(wrapper.text()).toContain('Carregando o pedido');
    await settle();
    click('Tentar de novo');
    await settle();
    expect(wrapper.get('h1').text()).toBe('Pronto! Recebemos seu pedido.');
    expect(wrapper.get('[data-testid="order-number"]').text()).toBe('2026-000031');
    expect(wrapper.find('a[href="/minha-conta/pedidos/31"]').exists()).toBe(true);
  });
});

describe('my orders', () => {
  it('lists orders with pagination', async () => {
    const api = mockApi().on('GET /api/v1/orders', {
      body: orderList([orderListItem(), orderListItem({ id: 32, number: '2026-000032', itemCount: 1 })], 15),
    });
    const wrapper = await mountSuspended(OrdersPage, { route: '/minha-conta/pedidos' });
    expect(wrapper.text()).toContain('Carregando pedidos');
    await settle();
    expect(wrapper.text()).toContain('Pedido 2026-000031');
    expect(wrapper.text()).toContain('2 itens');
    expect(wrapper.text()).toContain('1 item');
    await wrapper.get('button[aria-label="Próxima página"]').trigger('click');
    await settle();
    expect(api.called('GET /api/v1/orders').at(-1)!.url.searchParams.get('page')).toBe('2');
  });

  it('shows the empty state and errors', async () => {
    mockApi().on('GET /api/v1/orders', new TypeError('offline'), { body: orderList([]) });
    const wrapper = await mountSuspended(OrdersPage, {
      route: '/minha-conta/pedidos',
      attachTo: document.body,
    });
    await settle();
    click('Tentar de novo');
    await settle();
    expect(wrapper.text()).toContain('Nenhum pedido por aqui ainda');
  });
});

describe('order page', () => {
  it('shows the timeline and cancels after confirmation', async () => {
    const canceled = order({
      status: 'CANCELED',
      canCancel: false,
      events: [
        ...order().events,
        {
          fromStatus: 'PENDING_REVIEW',
          toStatus: 'CANCELED',
          label: 'Pedido cancelado',
          actor: null,
          reason: 'Comprei por engano.',
          createdAt: '2026-10-03T16:00:00.000Z',
        },
      ],
    });
    const api = mockApi().on('GET /api/v1/orders/31', { body: order() }).on(
      'POST /api/v1/orders/31/cancellation',
      problem(409, 'Este pedido já foi separado.'),
      { body: canceled },
      {
        body: canceled,
      },
    );
    const wrapper = await mountSuspended(OrderPage, {
      route: '/minha-conta/pedidos/31',
      attachTo: document.body,
    });
    await settle();
    expect(wrapper.get('h2').text()).toBe('Pedido 2026-000031');
    expect(wrapper.text()).toContain('Retiro na sexta.');
    expect(wrapper.text()).toContain('Pedido recebido');
    click('Cancelar pedido');
    await settle();
    click('Voltar');
    await settle();
    click('Cancelar pedido');
    await settle();
    (document.querySelector('[role="dialog"] button[aria-label="Fechar"]') as HTMLButtonElement).click();
    await settle();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    click('Cancelar pedido');
    await settle();
    click('Cancelar pedido', 1);
    await settle();
    expect(toastTitles()).toContain('Este pedido já foi separado.');
    (document.querySelector('[role="dialog"] textarea') as HTMLTextAreaElement).value =
      ' Comprei por engano. ';
    document.querySelector('[role="dialog"] textarea')!.dispatchEvent(new Event('input'));
    click('Cancelar pedido', 1);
    await settle();
    expect(api.called('POST /api/v1/orders/31/cancellation').at(-1)!.body).toEqual({
      reason: 'Comprei por engano.',
    });
    expect(toastTitles()).toContain('Pedido cancelado. Os itens voltaram para a loja.');
    expect(wrapper.text()).toContain('Comprei por engano.');
    expect(wrapper.text()).not.toContain('Cancelar pedido');
  });

  it('cancels without a reason and shows not found and errors', async () => {
    const api = mockApi()
      .on('GET /api/v1/orders/31', { body: order({ notes: null }) })
      .on('POST /api/v1/orders/31/cancellation', { body: order({ canCancel: false, status: 'CANCELED' }) });
    const wrapper = await mountSuspended(OrderPage, {
      route: '/minha-conta/pedidos/31',
      attachTo: document.body,
    });
    await settle();
    expect(wrapper.text()).not.toContain('Observações');
    click('Cancelar pedido');
    await settle();
    click('Cancelar pedido', 1);
    await settle();
    expect(api.called('POST /api/v1/orders/31/cancellation')[0]!.body).toEqual({});
    document.body.innerHTML = '';

    mockApi().on('GET /api/v1/orders/99', problem(404, 'Pedido não encontrado.'));
    const missing = await mountSuspended(OrderPage, { route: '/minha-conta/pedidos/99' });
    await settle();
    expect(missing.text()).toContain('Procuramos em todas as prateleiras');
    mockApi().on('GET /api/v1/orders/98', new TypeError('offline'));
    const offline = await mountSuspended(OrderPage, { route: '/minha-conta/pedidos/98' });
    expect(offline.text()).toContain('Carregando o pedido');
    await settle();
    expect(offline.text()).toContain('Tentar de novo');
  });
});
