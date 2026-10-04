import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { products } from '../../infra/db/schema.js';
import { createCategory, createProduct } from '../../../test/catalog.js';
import { useTestApp } from '../../../test/harness.js';

describe('catalog browsing', () => {
  const t = useTestApp();
  let fridges: number;
  let air: number;
  let managerHeaders: Record<string, string>;

  const names = (response: { json(): { data: Array<{ name: string }> } }) =>
    response.json().data.map((p) => p.name);

  const get = (query: string, headers: Record<string, string> = {}) =>
    t.app.inject({ method: 'GET', url: `/api/v1/products${query}`, headers });

  beforeEach(async () => {
    fridges = (await createCategory(t, 'Geladeiras', 0)).id;
    air = (await createCategory(t, 'Ar condicionado', 1)).id;
    managerHeaders = (await t.as('MANAGER')).headers;
    const fixtures = [
      {
        name: 'Geladeira Brastemp Frost Free',
        brand: 'Brastemp',
        categoryId: fridges,
        priceCents: 350_000,
        initialStock: 2,
      },
      {
        name: 'Geladeira Consul Duplex',
        brand: 'Consul',
        categoryId: fridges,
        priceCents: 250_000,
        condition: 'USED' as const,
      },
      {
        name: 'Refrigerador Electrolux Inverse',
        brand: 'Electrolux',
        categoryId: fridges,
        priceCents: 420_000,
        initialStock: 1,
      },
      {
        name: 'Ar Condicionado Split Springer Midea',
        brand: 'Springer',
        categoryId: air,
        priceCents: 199_000,
        initialStock: 5,
      },
      {
        name: 'Ar Condicionado Janela Gree',
        brand: 'gree',
        categoryId: air,
        priceCents: 150_000,
        initialStock: 1,
      },
      {
        name: 'Ar Condicionado Portátil Gree',
        brand: 'Gree',
        categoryId: air,
        priceCents: 180_000,
        initialStock: 1,
      },
      { name: 'Ventilador Peça Única', brand: null, categoryId: air, priceCents: 9_900, initialStock: 1 },
    ];
    for (const fixture of fixtures) {
      await createProduct(t, managerHeaders, fixture);
      t.clock.advance(60_000);
    }
  });

  it('lists the newest first with covers, availability and pagination', async () => {
    const response = await get('?pageSize=2&page=2');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      meta: { page: 2, pageSize: 2, total: 7 },
      data: [
        { name: 'Ar Condicionado Janela Gree', cover: null },
        { name: 'Ar Condicionado Split Springer Midea' },
      ],
    });
    const consul = (await get('?q=consul')).json().data[0];
    expect(consul).toMatchObject({ available: false, condition: 'USED', categoryName: 'Geladeiras' });
  });

  it('searches ignoring accents and case', async () => {
    expect(names(await get('?q=PORTATIL'))).toEqual(['Ar Condicionado Portátil Gree']);
    expect(names(await get('?q=pe%C3%A7a%20%C3%BAnica'))).toEqual(['Ventilador Peça Única']);
    expect(names(await get('?q=geladeiras%20brastemp'))).toEqual(['Geladeira Brastemp Frost Free']);
  });

  it('tolerates typos and orders by relevance', async () => {
    // The category name is searchable too: the Electrolux is in Geladeiras.
    expect(names(await get('?q=geladeria'))).toEqual([
      'Geladeira Brastemp Frost Free',
      'Geladeira Consul Duplex',
      'Refrigerador Electrolux Inverse',
    ]);
    expect(names(await get('?q=brastenp'))).toEqual(['Geladeira Brastemp Frost Free']);
    expect(names(await get('?q=eletrolux'))).toEqual(['Refrigerador Electrolux Inverse']);
    // A product whose name starts with the term comes before one that only mentions it in the category.
    expect(names(await get('?q=geladeira'))).toEqual([
      'Geladeira Brastemp Frost Free',
      'Geladeira Consul Duplex',
      'Refrigerador Electrolux Inverse',
    ]);
    await createProduct(t, managerHeaders, { name: 'Acessório para geladeira', categoryId: air });
    expect(names(await get('?q=geladeira&pageSize=3'))).toEqual([
      'Geladeira Brastemp Frost Free',
      'Geladeira Consul Duplex',
      'Acessório para geladeira',
    ]);
    expect((await get('?q=liquidificador')).json().meta.total).toBe(0);
    expect((await get('?q=%25_')).json().meta.total).toBe(8);
  });

  it('filters by category, condition, brand, price and availability', async () => {
    expect((await get(`?categoryId=${air}`)).json().meta.total).toBe(4);
    expect(names(await get('?condition=USED'))).toEqual(['Geladeira Consul Duplex']);
    expect((await get('?brand=GREE')).json().meta.total).toBe(2);
    expect(names(await get('?minPriceCents=200000&maxPriceCents=360000&sort=priceAsc'))).toEqual([
      'Geladeira Consul Duplex',
      'Geladeira Brastemp Frost Free',
    ]);
    expect(names(await get('?available=false'))).toEqual(['Geladeira Consul Duplex']);
    expect((await get('?available=true')).json().meta.total).toBe(6);
    expect((await get('?available=talvez')).json().errors).toEqual([
      { path: 'available', message: 'Use true ou false.' },
    ]);
    expect((await get('?minPriceCents=10&maxPriceCents=5')).json().errors).toEqual([
      { path: 'maxPriceCents', message: 'O preço máximo deve ser maior que o mínimo.' },
    ]);
    const facets = await t.app.inject({
      method: 'GET',
      url: '/api/v1/products/facets?minPriceCents=10&maxPriceCents=5',
    });
    expect(facets.statusCode).toBe(422);
  });

  it('sorts by name, price and relevance without a query', async () => {
    expect(names(await get('?sort=name&pageSize=2'))).toEqual([
      'Ar Condicionado Janela Gree',
      'Ar Condicionado Portátil Gree',
    ]);
    expect(names(await get('?sort=priceDesc&pageSize=1'))).toEqual(['Refrigerador Electrolux Inverse']);
    expect(names(await get('?sort=priceAsc&pageSize=1'))).toEqual(['Ventilador Peça Única']);
    expect(names(await get('?sort=relevance&pageSize=1'))).toEqual(['Ventilador Peça Única']);
    expect(names(await get('?q=gree&sort=newest'))).toEqual([
      'Ar Condicionado Portátil Gree',
      'Ar Condicionado Janela Gree',
    ]);
  });

  it('shows archived products only to the staff that asks for them', async () => {
    const [consul] = await t.db.select().from(products).where(eq(products.brand, 'Consul'));
    await t.db.update(products).set({ archivedAt: t.clock.now() }).where(eq(products.id, consul!.id));
    expect((await get('')).json().meta.total).toBe(6);
    expect((await get('?includeArchived=true')).json().meta.total).toBe(6);
    const client = await t.as('CLIENT');
    expect((await get('?includeArchived=true', client.headers)).json().meta.total).toBe(6);
    expect((await get('?includeArchived=true', managerHeaders)).json().meta.total).toBe(7);
    expect((await get('?includeArchived=false', managerHeaders)).json().meta.total).toBe(6);
    const listed = (await get('?q=consul&includeArchived=true', managerHeaders)).json().data[0];
    expect(listed).toMatchObject({ archived: true });
  });

  it('computes facets, each ignoring its own filter', async () => {
    const all = await t.app.inject({ method: 'GET', url: '/api/v1/products/facets' });
    expect(all.json()).toEqual({
      brands: [
        { brand: 'Gree', count: 2 },
        { brand: 'Brastemp', count: 1 },
        { brand: 'Consul', count: 1 },
        { brand: 'Electrolux', count: 1 },
        { brand: 'Springer', count: 1 },
      ],
      categories: [
        { categoryId: fridges, name: 'Geladeiras', count: 3 },
        { categoryId: air, name: 'Ar condicionado', count: 4 },
      ],
      conditions: [
        { condition: 'NEW', count: 6 },
        { condition: 'USED', count: 1 },
      ],
      price: { minCents: 9_900, maxCents: 420_000 },
      availability: { available: 6, unavailable: 1 },
    });

    const filtered = await t.app.inject({
      method: 'GET',
      url: `/api/v1/products/facets?categoryId=${fridges}&condition=NEW&brand=Brastemp&minPriceCents=300000&available=true`,
    });
    expect(filtered.json()).toEqual({
      brands: [
        { brand: 'Brastemp', count: 1 },
        { brand: 'Electrolux', count: 1 },
      ],
      categories: [{ categoryId: fridges, name: 'Geladeiras', count: 1 }],
      conditions: [{ condition: 'NEW', count: 1 }],
      price: { minCents: 350_000, maxCents: 350_000 },
      availability: { available: 1, unavailable: 0 },
    });

    const none = await t.app.inject({ method: 'GET', url: '/api/v1/products/facets?q=liquidificador' });
    expect(none.json()).toMatchObject({
      brands: [],
      price: null,
      availability: { available: 0, unavailable: 0 },
    });
  });
});
