import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  auditLogs,
  orderItems,
  orders,
  productImages,
  products,
  stockMovements,
  storeSettings,
} from '../../infra/db/schema.js';
import { createCategory, createProduct } from '../../../test/catalog.js';
import { useTestApp } from '../../../test/harness.js';
import { jpeg } from '../../../test/images.js';
import { multipart } from '../../../test/multipart.js';
import { baseSlug, nextSlug } from './products.js';

const fridge = {
  name: 'Geladeira Brastemp Frost Free 375L',
  brand: 'Brastemp',
  model: 'BRM44HK',
  condition: 'NEW',
  description: 'Duas portas, inox.',
  priceCents: 349_900,
  initialStock: 3,
  stockMin: 2,
} as const;

describe('slugs', () => {
  it('never produces a purely numeric slug', () => {
    expect(baseSlug('Geladeira Consul')).toBe('geladeira-consul');
    expect(baseSlug('12345')).toBe('produto-12345');
    expect(baseSlug('!!!')).toBe('produto');
  });

  it('takes the first free suffix', () => {
    expect(nextSlug('x', [])).toBe('x');
    expect(nextSlug('x', ['x'])).toBe('x-2');
    expect(nextSlug('x', ['x', 'x-2', 'x-4'])).toBe('x-3');
  });
});

describe('product routes', () => {
  const t = useTestApp();

  async function setup() {
    const category = await createCategory(t, 'Geladeiras');
    const manager = await t.as('MANAGER');
    return { category, manager };
  }

  describe('POST /products', () => {
    it('creates the product with a slug, search text, initial stock movement and audit', async () => {
      const { category, manager } = await setup();
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers: manager.headers,
        payload: { ...fridge, categoryId: category.id },
      });
      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(response.headers.location).toBe(`/api/v1/products/${body.id}`);
      expect(response.headers.etag).toBe('W/"1"');
      expect(body).toMatchObject({
        slug: 'geladeira-brastemp-frost-free-375l',
        categoryName: 'Geladeiras',
        stockAvailable: 3,
        available: true,
        lowStock: false,
        archived: false,
        images: [],
        version: 1,
      });
      const [row] = await t.db.select().from(products).where(eq(products.id, body.id));
      expect(row!.searchText).toBe('geladeira brastemp frost free 375l brastemp brm44hk geladeiras');
      const movements = await t.db.select().from(stockMovements);
      expect(movements).toEqual([
        expect.objectContaining({
          type: 'IN',
          quantity: 3,
          reason: 'Estoque inicial',
          authorId: manager.user.id,
        }),
      ]);
      const [audit] = await t.db.select().from(auditLogs).where(eq(auditLogs.action, 'product.create'));
      expect(audit).toMatchObject({ actorId: manager.user.id, after: { name: fridge.name } });
    });

    it('applies defaults and records no movement without initial stock', async () => {
      const { category, manager } = await setup();
      const product = await createProduct(t, manager.headers, {
        categoryId: category.id,
        name: 'Peça avulsa',
      });
      expect(product).toMatchObject({
        stockAvailable: 0,
        condition: 'NEW',
        description: '',
        brand: null,
        stockMin: null,
        available: false,
        lowStock: true,
      });
      expect(await t.db.select().from(stockMovements)).toEqual([]);
    });

    it('suffixes repeated slugs, also when created concurrently', async () => {
      const { category, manager } = await setup();
      const created = await Promise.all(
        [1, 2, 3, 4].map(() =>
          createProduct(t, manager.headers, { categoryId: category.id, name: 'Freezer Consul' }),
        ),
      );
      expect(created.map((p) => p.slug).sort()).toEqual([
        'freezer-consul',
        'freezer-consul-2',
        'freezer-consul-3',
        'freezer-consul-4',
      ]);
    });

    it('validates fields in Portuguese', async () => {
      const { manager } = await setup();
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers: manager.headers,
        payload: { name: 'X', priceCents: -1, condition: 'BROKEN', initialStock: 1.5 },
      });
      expect(response.statusCode).toBe(422);
      const messages = Object.fromEntries(
        response.json().errors.map((e: { path: string; message: string }) => [e.path, e.message]),
      );
      expect(messages).toMatchObject({
        name: 'Informe o nome do produto.',
        categoryId: 'Escolha a categoria.',
        condition: 'Escolha novo ou usado.',
        priceCents: 'O preço não pode ser negativo.',
        initialStock: 'Informe um número inteiro.',
      });

      const unknownCategory = await t.app.inject({
        method: 'POST',
        url: '/api/v1/products',
        headers: manager.headers,
        payload: { ...fridge, categoryId: 999999 },
      });
      expect(unknownCategory.json()).toMatchObject({
        status: 422,
        errors: [{ path: 'categoryId', message: 'Escolha uma categoria existente.' }],
      });
    });
  });

  describe('GET /products/:id (id or slug)', () => {
    it('finds by id or slug with an ETag, hiding archived products from the public', async () => {
      const { category, manager } = await setup();
      const product = await createProduct(t, manager.headers, { ...fridge, categoryId: category.id });
      const byId = await t.app.inject({ method: 'GET', url: `/api/v1/products/${product.id}` });
      expect(byId.statusCode).toBe(200);
      expect(byId.headers.etag).toBe('W/"1"');
      const bySlug = await t.app.inject({ method: 'GET', url: `/api/v1/products/${product.slug}` });
      expect(bySlug.json().id).toBe(product.id);

      await t.db.update(products).set({ archivedAt: t.clock.now() }).where(eq(products.id, product.id));
      const hidden = await t.app.inject({ method: 'GET', url: `/api/v1/products/${product.slug}` });
      expect(hidden.statusCode).toBe(404);
      const customer = await t.as('CLIENT');
      const hiddenForClient = await t.app.inject({
        method: 'GET',
        url: `/api/v1/products/${product.id}`,
        headers: customer.headers,
      });
      expect(hiddenForClient.statusCode).toBe(404);
      const visible = await t.app.inject({
        method: 'GET',
        url: `/api/v1/products/${product.id}`,
        headers: manager.headers,
      });
      expect(visible.json()).toMatchObject({ archived: true, archivedAt: expect.any(String) });

      expect((await t.app.inject({ method: 'GET', url: '/api/v1/products/nao-existe' })).statusCode).toBe(
        404,
      );
      expect((await t.app.inject({ method: 'GET', url: '/api/v1/products/Maiusculas' })).statusCode).toBe(
        422,
      );
    });

    it('marks low stock against the product minimum or the store default', async () => {
      const { category, manager } = await setup();
      const own = await createProduct(t, manager.headers, {
        categoryId: category.id,
        name: 'Com mínimo',
        initialStock: 2,
        stockMin: 3,
      });
      const store = await createProduct(t, manager.headers, {
        categoryId: category.id,
        name: 'Sem mínimo',
        initialStock: 2,
      });
      expect(own).toMatchObject({ lowStock: true });
      expect(store).toMatchObject({ lowStock: false });
      await t.db.update(storeSettings).set({ defaultStockMin: 5 });
      const detail = await t.app.inject({ method: 'GET', url: `/api/v1/products/${store.id}` });
      expect(detail.json().lowStock).toBe(true);
    });
  });

  describe('PATCH /products/:id', () => {
    it('requires If-Match, refuses stale versions and keeps the slug', async () => {
      const { category, manager } = await setup();
      const other = await createCategory(t, 'Freezers');
      const product = await createProduct(t, manager.headers, { ...fridge, categoryId: category.id });
      const patch = (headers: Record<string, string>, payload: object) =>
        t.app.inject({
          method: 'PATCH',
          url: `/api/v1/products/${product.id}`,
          headers: { ...manager.headers, ...headers },
          payload,
        });

      expect((await patch({}, { priceCents: 1 })).statusCode).toBe(428);
      const edited = await patch(
        { 'if-match': 'W/"1"' },
        { name: 'Geladeira Brastemp Inox', priceCents: 329_900, categoryId: other.id, brand: '' },
      );
      expect(edited.statusCode).toBe(200);
      expect(edited.headers.etag).toBe('W/"2"');
      expect(edited.json()).toMatchObject({
        slug: product.slug,
        name: 'Geladeira Brastemp Inox',
        priceCents: 329_900,
        categoryName: 'Freezers',
        brand: null,
        version: 2,
      });
      const [row] = await t.db.select().from(products).where(eq(products.id, product.id));
      expect(row!.searchText).toBe('geladeira brastemp inox brm44hk freezers');

      const stale = await patch({ 'if-match': 'W/"1"' }, { priceCents: 1 });
      expect(stale.statusCode).toBe(412);
      expect(stale.json().title).toBe('Registro alterado por outra pessoa');

      const badCategory = await patch({ 'if-match': 'W/"2"' }, { categoryId: 999999 });
      expect(badCategory.statusCode).toBe(422);
      const only = await patch({ 'if-match': 'W/"2"' }, { description: 'Nova descrição' });
      expect(only.json()).toMatchObject({
        description: 'Nova descrição',
        categoryName: 'Freezers',
        version: 3,
      });

      const missing = await t.app.inject({
        method: 'PATCH',
        url: '/api/v1/products/999999',
        headers: { ...manager.headers, 'if-match': '*' },
        payload: {},
      });
      expect(missing.statusCode).toBe(404);

      const [audit] = await t.db.select().from(auditLogs).where(eq(auditLogs.action, 'product.update'));
      expect(audit).toMatchObject({
        before: { name: fridge.name, version: 1 },
        after: { name: 'Geladeira Brastemp Inox', version: 2 },
      });
    });

    it('lets only one of two concurrent edits of the same version win', async () => {
      const { category, manager } = await setup();
      const product = await createProduct(t, manager.headers, { categoryId: category.id, name: 'Freezer' });
      const results = await Promise.all(
        [1, 2, 3].map((n) =>
          t.app.inject({
            method: 'PATCH',
            url: `/api/v1/products/${product.id}`,
            headers: { ...manager.headers, 'if-match': 'W/"1"' },
            payload: { priceCents: n },
          }),
        ),
      );
      expect(results.map((r) => r.statusCode).sort()).toEqual([200, 412, 412]);
    });
  });

  describe('DELETE /products/:id', () => {
    async function upload(productId: number, headers: Record<string, string>, ...files: Buffer[]) {
      const body = multipart(files.map((value, i) => ({ name: 'fotos', value, filename: `${i}.jpg` })));
      const response = await t.app.inject({
        method: 'POST',
        url: `/api/v1/products/${productId}/images`,
        payload: body.payload,
        headers: { ...headers, ...body.headers },
      });
      expect(response.statusCode).toBe(201);
      return response.json<Array<{ id: number; url: string }>>();
    }

    it('deletes a never sold product with its photos, keeping files other products use', async () => {
      const { category, manager } = await setup();
      const admin = await t.as('ADMIN');
      const product = await createProduct(t, manager.headers, {
        categoryId: category.id,
        name: 'Freezer',
        initialStock: 2,
      });
      const sibling = await createProduct(t, manager.headers, {
        categoryId: category.id,
        name: 'Freezer irmão',
      });
      const shared = await jpeg(400, 300);
      const own = await jpeg(500, 300);
      await upload(product.id, manager.headers, shared, own);
      await upload(sibling.id, manager.headers, shared);
      const keys = (
        await t.db.select().from(productImages).where(eq(productImages.productId, product.id))
      ).map((image) => image.storageKey);

      const response = await t.app.inject({
        method: 'DELETE',
        url: `/api/v1/products/${product.id}`,
        headers: admin.headers,
      });
      expect(response.json()).toEqual({ result: 'deleted' });
      expect(await t.db.select().from(products).where(eq(products.id, product.id))).toEqual([]);
      expect(await t.ctx.storage.get(`${keys[0]}/320.webp`)).not.toBeNull();
      expect(await t.ctx.storage.get(`${keys[1]}/320.webp`)).toBeNull();
      const [audit] = await t.db.select().from(auditLogs).where(eq(auditLogs.action, 'product.delete'));
      expect(audit).toMatchObject({ resourceId: String(product.id), before: { name: 'Freezer' } });

      const plain = await t.app.inject({
        method: 'DELETE',
        url: `/api/v1/products/${sibling.id}`,
        headers: admin.headers,
      });
      expect(plain.json()).toEqual({ result: 'deleted' });
      expect(await t.ctx.storage.get(`${keys[0]}/320.webp`)).toBeNull();
      const empty = await createProduct(t, manager.headers, { categoryId: category.id, name: 'Sem fotos' });
      const noImages = await t.app.inject({
        method: 'DELETE',
        url: `/api/v1/products/${empty.id}`,
        headers: admin.headers,
      });
      expect(noImages.json()).toEqual({ result: 'deleted' });
    });

    it('archives a product with orders and unarchives it later (decision D9)', async () => {
      const { category, manager } = await setup();
      const admin = await t.as('ADMIN');
      const product = await createProduct(t, manager.headers, { categoryId: category.id, name: 'Lavadora' });
      const customer = await t.createUser('CLIENT');
      const [order] = await t.db
        .insert(orders)
        .values({
          customerId: customer.id,
          channel: 'ONLINE',
          status: 'PICKED_UP',
          totalCents: 100,
          createdById: customer.id,
        })
        .returning();
      await t.db.insert(orderItems).values({
        orderId: order!.id,
        productId: product.id,
        productName: 'Lavadora',
        unitPriceCents: 100,
        quantity: 1,
      });

      const archived = await t.app.inject({
        method: 'DELETE',
        url: `/api/v1/products/${product.id}`,
        headers: admin.headers,
      });
      expect(archived.json()).toEqual({ result: 'archived' });
      const [row] = await t.db.select().from(products).where(eq(products.id, product.id));
      expect(row!.archivedAt).toEqual(t.clock.now());

      t.clock.advance(60_000);
      const again = await t.app.inject({
        method: 'DELETE',
        url: `/api/v1/products/${product.id}`,
        headers: admin.headers,
      });
      expect(again.json()).toEqual({ result: 'archived' });
      const [still] = await t.db.select().from(products).where(eq(products.id, product.id));
      expect(still!.archivedAt).toEqual(row!.archivedAt);

      const unarchive = (id: number) =>
        t.app.inject({ method: 'POST', url: `/api/v1/products/${id}/unarchive`, headers: admin.headers });
      const restored = await unarchive(product.id);
      expect(restored.json()).toMatchObject({ archived: false, archivedAt: null });
      const idempotent = await unarchive(product.id);
      expect(idempotent.statusCode).toBe(200);
      expect((await unarchive(999999)).statusCode).toBe(404);

      const actions = (await t.db.select().from(auditLogs)).map((entry) => entry.action);
      expect(actions.filter((a) => a === 'product.archive')).toHaveLength(2);
      expect(actions.filter((a) => a === 'product.unarchive')).toHaveLength(1);

      const managerDelete = await t.app.inject({
        method: 'DELETE',
        url: `/api/v1/products/${product.id}`,
        headers: manager.headers,
      });
      expect(managerDelete.statusCode).toBe(403);
      expect(
        (await t.app.inject({ method: 'DELETE', url: '/api/v1/products/999999', headers: admin.headers }))
          .statusCode,
      ).toBe(404);
    });
  });
});
