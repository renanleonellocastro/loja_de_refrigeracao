import { mountSuspended } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CatalogFilters from '~/components/catalog/Filters.vue';
import CatalogGallery from '~/components/catalog/Gallery.vue';
import CatalogProductCard from '~/components/catalog/ProductCard.vue';
import CatalogProductImage from '~/components/catalog/ProductImage.vue';
import CatalogQuantityStepper from '~/components/catalog/QuantityStepper.vue';
import LayoutCartBadge from '~/components/layout/CartBadge.vue';
import OrderItems from '~/components/order/Items.vue';
import ProfileRecentOrders from '~/components/profile/RecentOrders.vue';
import { useCartStore } from '~/stores/cart';
import { filtersFromQuery } from '~/utils/catalog';
import { mockApi } from '../support/api';
import { FACETS, IMAGE, detail, guestCart, order, orderList, orderListItem, product } from '../support/shop';

afterEach(() => {
  useCartStore().guest = [];
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('CatalogProductImage', () => {
  it('uses the API variants and falls back to the placeholder', async () => {
    const wrapper = await mountSuspended(CatalogProductImage, {
      props: { image: IMAGE, alt: 'Compressor', eager: true },
    });
    const img = wrapper.get('img');
    expect(img.attributes('src')).toBe('http://localhost:3001/api/v1/media/abc/960.webp');
    expect(img.attributes('srcset')).toContain('http://localhost:3001/api/v1/media/abc/320.webp 320w');
    expect(img.attributes('width')).toBe('1200');
    expect(img.attributes('loading')).toBe('eager');
    expect(img.attributes('fetchpriority')).toBe('high');
    await img.trigger('error');
    expect(wrapper.get('img').attributes('src')).toBe('/illustrations/produto-sem-foto.svg');
    expect(wrapper.get('img').attributes('alt')).toBe('Compressor, sem foto');
    expect(wrapper.get('img').attributes('loading')).toBe('eager');
    expect(wrapper.get('img').attributes('fetchpriority')).toBe('high');
    await wrapper.setProps({ image: { ...IMAGE, url: '/outra.webp' }, eager: false });
    expect(wrapper.get('img').attributes('loading')).toBe('lazy');
    expect(wrapper.get('img').attributes('fetchpriority')).toBeUndefined();
    await wrapper.setProps({ image: null, alt: '' });
    expect(wrapper.get('img').attributes('alt')).toBe('');
  });
});

describe('CatalogProductCard', () => {
  it('shows price, brand and the low stock hint', async () => {
    const wrapper = await mountSuspended(CatalogProductCard, {
      props: { product: product({ lowStock: true }), eager: true },
    });
    expect(wrapper.get('h2 a').attributes('href')).toBe('/produtos/compressor-embraco');
    expect(wrapper.text()).toContain('Embraco');
    expect(wrapper.text()).toContain('R$ 499,00');
    expect(wrapper.text()).toContain('Últimas unidades');
    expect(wrapper.text()).not.toContain('Indisponível');
  });

  it('fades unavailable and used products', async () => {
    const wrapper = await mountSuspended(CatalogProductCard, {
      props: {
        product: product({ available: false, condition: 'USED', brand: null, lowStock: true }),
        headingLevel: 3,
      },
    });
    expect(wrapper.get('h3').exists()).toBe(true);
    expect(wrapper.text()).toContain('Indisponível');
    expect(wrapper.text()).toContain('Usado');
    expect(wrapper.text()).toContain('Peças e acessórios');
    expect(wrapper.text()).not.toContain('Últimas unidades');
    expect(wrapper.get('article').attributes('data-available')).toBe('false');
  });
});

describe('CatalogFilters', () => {
  it('emits each change and the price range', async () => {
    const filters = filtersFromQuery({ categoria: '7', condicao: 'novo', marca: 'Embraco', min: '10' });
    const wrapper = await mountSuspended(CatalogFilters, {
      props: { filters, facets: FACETS, idPrefix: 'teste' },
    });
    expect(wrapper.text()).toContain('11 com estoque');
    expect(wrapper.text()).toContain('De R$ 499 a R$ 3.599');
    const radios = wrapper.findAll('input[type="radio"]');
    // Categories: Todas, 7, 1; conditions: all, NEW, USED; brands: Todas, Embraco, Consul.
    expect(radios).toHaveLength(9);
    for (const radio of radios) await radio.trigger('change');
    await wrapper.get('button[role="switch"]').trigger('click');
    const inputs = wrapper.findAll('input[inputmode="numeric"]');
    await inputs[0]!.setValue('');
    await inputs[1]!.setValue('2.000');
    await wrapper.get('form').trigger('submit');
    await wrapper.findAll('button').at(-1)!.trigger('click');
    expect(wrapper.emitted('change')).toEqual([
      [{ categoryId: undefined }],
      [{ categoryId: 7 }],
      [{ categoryId: 1 }],
      [{ condition: undefined }],
      [{ condition: 'NEW' }],
      [{ condition: 'USED' }],
      [{ brand: undefined }],
      [{ brand: 'Embraco' }],
      [{ brand: 'Consul' }],
      [{ onlyAvailable: true }],
      [{ minPrice: undefined, maxPrice: 2000 }],
    ]);
    expect(wrapper.emitted('clear')).toHaveLength(1);
    expect(wrapper.text()).toContain('0');
    await wrapper.setProps({ filters: { ...filters, minPrice: undefined, maxPrice: 300 } });
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('');
    expect((inputs[1]!.element as HTMLInputElement).value).toBe('300');
    await wrapper.setProps({ filters: { ...filters, minPrice: 5, maxPrice: undefined } });
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('5');
  });

  it('works before the counts arrive', async () => {
    const wrapper = await mountSuspended(CatalogFilters, {
      props: { filters: filtersFromQuery({}), facets: null, idPrefix: 'vazio' },
    });
    expect(wrapper.text()).not.toContain('com estoque');
    expect(wrapper.text()).not.toContain('Marca');
    const noPrice = await mountSuspended(CatalogFilters, {
      props: { filters: filtersFromQuery({}), facets: { ...FACETS, brands: [], price: null }, idPrefix: 'x' },
    });
    expect(noPrice.text()).not.toContain('De R$ 4');
  });
});

describe('CatalogGallery', () => {
  it('swipes, follows the arrows and the thumbnails', async () => {
    const wrapper = await mountSuspended(CatalogGallery, {
      props: { images: detail().images, name: 'Compressor' },
      attachTo: document.body,
    });
    const track = wrapper.get('[role="region"]').element as HTMLElement;
    Object.defineProperty(track, 'clientWidth', { value: 300, configurable: true });
    track.scrollTo = vi.fn();
    const next = wrapper.get('button[aria-label="Próxima foto"]');
    const previous = wrapper.get('button[aria-label="Foto anterior"]');
    expect(previous.attributes('disabled')).toBeDefined();
    await next.trigger('click');
    expect(track.scrollTo).toHaveBeenCalledWith({ left: 300, behavior: 'smooth' });
    expect(wrapper.text()).toContain('2/2');
    expect(next.attributes('disabled')).toBeDefined();
    await previous.trigger('click');
    await wrapper.findAll('[aria-label^="Ver foto"]')[1]!.trigger('click');
    expect(wrapper.get('[aria-label="Ver foto 2"]').attributes('aria-current')).toBe('true');
    track.scrollLeft = 0;
    await wrapper.get('[role="region"]').trigger('scroll');
    expect(wrapper.text()).toContain('1/2');
    Object.defineProperty(track, 'clientWidth', { value: 0, configurable: true });
    await wrapper.get('[role="region"]').trigger('scroll');
    expect(wrapper.text()).toContain('1/2');
    expect(wrapper.findAll('img')[1]!.attributes('alt')).toBe('Compressor, foto 2');
    wrapper.unmount();
  });

  it('shows the placeholder without photos and no arrows for one photo', async () => {
    const none = await mountSuspended(CatalogGallery, { props: { images: [], name: 'Peça' } });
    expect(none.get('img').attributes('src')).toBe('/illustrations/produto-sem-foto.svg');
    const one = await mountSuspended(CatalogGallery, {
      props: { images: detail().images.slice(0, 1), name: 'Peça' },
    });
    expect(one.find('button').exists()).toBe(false);
  });
});

describe('CatalogQuantityStepper', () => {
  it('stays between 1 and the stock', async () => {
    const wrapper = await mountSuspended(CatalogQuantityStepper, {
      props: {
        modelValue: 1,
        max: 2,
        'onUpdate:modelValue': (value: number) => wrapper.setProps({ modelValue: value }),
      },
    });
    const minus = wrapper.get('button[aria-label="Diminuir quantidade"]');
    const plus = wrapper.get('button[aria-label="Aumentar quantidade"]');
    expect(minus.attributes('disabled')).toBeDefined();
    await plus.trigger('click');
    expect(wrapper.props('modelValue')).toBe(2);
    expect(plus.attributes('disabled')).toBeDefined();
    await minus.trigger('click');
    expect(wrapper.props('modelValue')).toBe(1);
    const input = wrapper.get('input');
    await input.setValue('50');
    await input.trigger('change');
    expect(wrapper.props('modelValue')).toBe(2);
    await input.setValue('abc');
    await input.trigger('change');
    expect(wrapper.props('modelValue')).toBe(1);
    expect((input.element as HTMLInputElement).value).toBe('1');
  });

  it('caps at 99 and has a small size', async () => {
    const wrapper = await mountSuspended(CatalogQuantityStepper, {
      props: { modelValue: 99, max: 500, size: 'sm', label: 'Quantidade de peça', disabled: true },
    });
    expect(wrapper.get('input').attributes('max')).toBe('99');
    expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Quantidade de peça');
    expect(wrapper.get('[role="group"]').classes()).toContain('h-10');
  });
});

describe('LayoutCartBadge', () => {
  it('shows the count only with items', async () => {
    const wrapper = await mountSuspended(LayoutCartBadge);
    expect(wrapper.find('[data-testid="cart-badge"]').exists()).toBe(false);
    useCartStore().guest = guestCart(1);
    await flushPromises();
    expect(wrapper.text()).toBe('1, 1 item');
    useCartStore().guest = guestCart(150);
    await flushPromises();
    expect(wrapper.text()).toBe('99+, 150 itens');
  });
});

describe('OrderItems', () => {
  it('lists items and the total', async () => {
    const wrapper = await mountSuspended(OrderItems, { props: { order: order() } });
    expect(wrapper.text()).toContain('2 × R$ 499,00');
    expect(wrapper.text()).toContain('R$ 998,00');
  });
});

describe('ProfileRecentOrders', () => {
  it('shows the last orders and hides when there are none or offline', async () => {
    mockApi().on('GET /api/v1/orders', { body: orderList([orderListItem()]) });
    const wrapper = await mountSuspended(ProfileRecentOrders);
    await flushPromises();
    expect(wrapper.text()).toContain('Pedido 2026-000031');
    expect(wrapper.find('a[href="/minha-conta/pedidos"]').exists()).toBe(true);
    mockApi().on('GET /api/v1/orders', new TypeError('offline'));
    const offline = await mountSuspended(ProfileRecentOrders);
    await flushPromises();
    expect(offline.text()).toBe('');
  });
});
