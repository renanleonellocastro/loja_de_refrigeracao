import { mountSuspended } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StoreHours from '~/components/store/Hours.vue';
import StoreMap from '~/components/store/Map.vue';
import ContactPage from '~/pages/contato.vue';
import IndexPage from '~/pages/index.vue';
import AboutPage from '~/pages/sobre.vue';
import { FALLBACK_STORE } from '~/utils/store';
import { mockApi, problem } from '../support/api';
import { storeData } from '../support/home';
import { serviceType } from '../support/services';
import { product } from '../support/shop';
import { paged, settle } from '../support/staff';

const jsonLd = () =>
  [...document.head.querySelectorAll('script[type="application/ld+json"]')].map((script) =>
    JSON.parse(script.textContent ?? '{}'),
  );

afterEach(async () => {
  clearNuxtData();
  await settle();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('home page', () => {
  it('shows the hero, services, featured products, reasons and the store from the API', async () => {
    const api = mockApi()
      .on('GET /api/v1/store', { body: storeData({ whatsapp: '19999998888' }) })
      .on('GET /api/v1/service-types', {
        body: [serviceType(), serviceType({ id: 2, name: 'Antigo', active: false })],
      })
      .on('GET /api/v1/products', paged([product(), product({ id: 2, slug: 'outro' })]));
    const page = await mountSuspended(IndexPage, { route: '/' });
    await settle();

    expect(page.get('h1').text()).toBe('Refrigeração Castro');
    expect(page.text()).toContain('há mais de 40 anos');
    expect(page.find('a[href="/agendar"]').text()).toContain('Agendar visita');
    expect(page.find('a[href="/orcamento"]').text()).toContain('Pedir orçamento');
    expect(page.find('source[media="(min-width: 768px)"]').attributes('srcset')).toBe(
      '/illustrations/fachada-hero.svg',
    );
    expect(page.find('img[fetchpriority="high"]').attributes('src')).toBe(
      '/illustrations/fachada-mobile.svg',
    );
    expect(page.findAll('[data-home-service]')).toHaveLength(1);
    expect(page.find('a[href="/agendar?servico=1"]').exists()).toBe(true);
    expect(page.text()).toContain('Produtos em destaque');
    expect(page.text()).toContain('Por que a Castro');
    expect(page.text()).toContain('Aberto agora');
    expect(page.find('a[href="tel:+551938041658"]').text()).toBe('(19) 3804-1658');
    expect(page.find('a[href^="https://wa.me/5519999998888"]').exists()).toBe(true);
    expect(api.called('GET /api/v1/products')[0]!.url.searchParams.get('available')).toBe('true');
    expect(jsonLd().find((item) => item['@type'] === 'HVACBusiness')).toMatchObject({
      name: 'Refrigeração Castro',
    });
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toMatch(/\/$/);
  });

  it('keeps working with the store defaults when the API is unreachable', async () => {
    mockApi()
      .on('GET /api/v1/store', new Error('offline'))
      .on('GET /api/v1/service-types', problem(500, 'Erro.'))
      .on('GET /api/v1/products', problem(500, 'Erro.'));
    const page = await mountSuspended(IndexPage, { route: '/' });
    await settle();
    expect(page.get('h1').text()).toBe('Refrigeração Castro');
    expect(page.findAll('[data-home-service]')).toHaveLength(0);
    expect(page.text()).toContain('Conheça os serviços');
    expect(page.text()).not.toContain('Produtos em destaque');
    expect(page.text()).toContain('Fechado agora');
    expect(page.find('a[href^="https://wa.me/"]').exists()).toBe(false);
  });
});

describe('about and contact pages', () => {
  it('tells the store history with the storefront photo', async () => {
    mockApi().on('GET /api/v1/store', { body: storeData() });
    const page = await mountSuspended(AboutPage, { route: '/sobre' });
    await settle();
    expect(page.get('h1').text()).toBe('Sobre a loja');
    expect(page.text()).toContain('três irmãos Castro');
    expect(page.text()).toContain('Eduardo Castro');
    expect(page.text()).not.toContain('1990');
    expect(page.find('img[alt^="Fachada azul"]').exists()).toBe(true);
  });

  it('lists address, phone, email, WhatsApp and hours', async () => {
    mockApi().on('GET /api/v1/store', {
      body: storeData({
        whatsapp: '19999998888',
        address: { ...FALLBACK_STORE.address, complement: 'Loja 2' },
      }),
    });
    const page = await mountSuspended(ContactPage, { route: '/contato' });
    await settle();
    expect(page.get('h1').text()).toBe('Contato');
    expect(page.text()).toContain('Rua Doutor Ulhoa Cintra, 91, Loja 2');
    expect(page.text()).toContain('Centro, Mogi Mirim/SP, CEP 13800-061');
    expect(page.get('[data-testid="contact-phone"]').attributes('href')).toBe('tel:+551938041658');
    expect(page.find('a[href="mailto:refrigeracaocastro@yahoo.com.br"]').exists()).toBe(true);
    expect(page.text()).toContain('WhatsApp (19) 99999-8888');
    expect(page.text()).toContain('Segunda a sexta:');
    expect(page.text()).toContain('Sábado e domingo:');
  });

  it('leaves WhatsApp out when the store has none', async () => {
    mockApi().on('GET /api/v1/store', { body: storeData() });
    const page = await mountSuspended(ContactPage, { route: '/contato' });
    await settle();
    expect(page.text()).not.toContain('WhatsApp');
  });
});

describe('store components', () => {
  it('loads the map embed only on request', async () => {
    const map = await mountSuspended(StoreMap, { props: { store: storeData() } });
    expect(map.find('iframe').exists()).toBe(false);
    expect(map.find('a[href^="https://www.google.com/maps/search/"]').exists()).toBe(true);
    await map
      .findAll('button')
      .find((button) => button.text() === 'Mostrar mapa')!
      .trigger('click');
    expect(map.get('iframe').attributes('src')).toContain('output=embed');
    expect(map.get('iframe').attributes('title')).toBe('Mapa: Rua Doutor Ulhoa Cintra, 91');
  });

  it('shows open or closed and the grouped hours', async () => {
    const closed = await mountSuspended(StoreHours, { props: { store: storeData({ openNow: false }) } });
    expect(closed.get('[data-testid="open-now"]').text()).toBe('Fechado agora');
    expect(closed.findAll('dt').map((term) => term.text())).toEqual([
      'Segunda a sexta:',
      'Sábado e domingo:',
    ]);
  });
});
