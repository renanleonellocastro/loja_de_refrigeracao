import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { auditLogs, products } from '../../infra/db/schema.js';
import { createCategory, createProduct } from '../../../test/catalog.js';
import { useTestApp } from '../../../test/harness.js';

describe('category routes', () => {
  const t = useTestApp();

  it('lists categories publicly by position then name, counting only active products', async () => {
    const fridges = await createCategory(t, 'Geladeiras', 1);
    await createCategory(t, 'Freezers', 1);
    await createCategory(t, 'Ar condicionado', 0);
    const { headers } = await t.as('MANAGER');
    await createProduct(t, headers, { categoryId: fridges.id, name: 'Geladeira Brastemp' });
    const archived = await createProduct(t, headers, { categoryId: fridges.id, name: 'Geladeira Consul' });
    await t.db.update(products).set({ archivedAt: t.clock.now() }).where(eq(products.id, archived.id));

    const response = await t.app.inject({ method: 'GET', url: '/api/v1/categories' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      { id: expect.any(Number), name: 'Ar condicionado', position: 0, productCount: 0 },
      { id: expect.any(Number), name: 'Freezers', position: 1, productCount: 0 },
      { id: fridges.id, name: 'Geladeiras', position: 1, productCount: 1 },
    ]);
  });

  it('creates categories at the end, refusing duplicate names in any case', async () => {
    const { headers } = await t.as('ADMIN');
    const first = await t.app.inject({
      method: 'POST',
      url: '/api/v1/categories',
      headers,
      payload: { name: '  Freezers ' },
    });
    expect(first.statusCode).toBe(201);
    expect(first.headers.location).toBe(`/api/v1/categories/${first.json().id}`);
    expect(first.json()).toMatchObject({ name: 'Freezers', position: 0, productCount: 0 });
    const second = await t.app.inject({
      method: 'POST',
      url: '/api/v1/categories',
      headers,
      payload: { name: 'Bebedouros' },
    });
    expect(second.json().position).toBe(1);

    const duplicate = await t.app.inject({
      method: 'POST',
      url: '/api/v1/categories',
      headers,
      payload: { name: 'FREEZERS' },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({
      title: 'Categoria já existe',
      errors: [{ path: 'name', message: 'Já existe uma categoria com este nome.' }],
    });

    const invalid = await t.app.inject({ method: 'POST', url: '/api/v1/categories', headers, payload: {} });
    expect(invalid.json().errors).toEqual([{ path: 'name', message: 'Informe o nome da categoria.' }]);

    const [audit] = await t.db.select().from(auditLogs).where(eq(auditLogs.action, 'category.create'));
    expect(audit).toMatchObject({ resourceType: 'category', after: { name: 'Freezers' } });
  });

  it('lets only the super user manage categories', async () => {
    const { headers } = await t.as('MANAGER');
    const response = await t.app.inject({
      method: 'POST',
      url: '/api/v1/categories',
      headers,
      payload: { name: 'Freezers' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('renames a category and refreshes the search text of its products', async () => {
    const category = await createCategory(t, 'Geladeiras');
    await createCategory(t, 'Freezers');
    const manager = await t.as('MANAGER');
    const product = await createProduct(t, manager.headers, {
      categoryId: category.id,
      name: 'Brastemp 375L',
    });
    const { headers } = await t.as('ADMIN');

    const renamed = await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/categories/${category.id}`,
      headers,
      payload: { name: 'Refrigeradores' },
    });
    expect(renamed.json()).toMatchObject({ name: 'Refrigeradores', productCount: 1 });
    const [row] = await t.db.select().from(products).where(eq(products.id, product.id));
    expect(row!.searchText).toBe('brastemp 375l refrigeradores');

    const same = await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/categories/${category.id}`,
      headers,
      payload: { name: 'refrigeradores' },
    });
    expect(same.statusCode).toBe(200);
    const taken = await t.app.inject({
      method: 'PATCH',
      url: `/api/v1/categories/${category.id}`,
      headers,
      payload: { name: 'Freezers' },
    });
    expect(taken.statusCode).toBe(409);
    const missing = await t.app.inject({
      method: 'PATCH',
      url: '/api/v1/categories/999999',
      headers,
      payload: { name: 'Nova' },
    });
    expect(missing.statusCode).toBe(404);

    const [audit] = await t.db.select().from(auditLogs).where(eq(auditLogs.action, 'category.update'));
    expect(audit).toMatchObject({ before: { name: 'Geladeiras' }, after: { name: 'Refrigeradores' } });
  });

  it('blocks deleting a category with products unless they are moved first', async () => {
    const source = await createCategory(t, 'Geladeiras');
    const target = await createCategory(t, 'Refrigeradores');
    const manager = await t.as('MANAGER');
    const product = await createProduct(t, manager.headers, { categoryId: source.id, name: 'Consul 300L' });
    const archived = await createProduct(t, manager.headers, { categoryId: source.id, name: 'Consul 200L' });
    await t.db.update(products).set({ archivedAt: t.clock.now() }).where(eq(products.id, archived.id));
    const { headers } = await t.as('ADMIN');

    const blocked = await t.app.inject({ method: 'DELETE', url: `/api/v1/categories/${source.id}`, headers });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toMatchObject({
      type: expect.stringContaining('category-in-use'),
      productCount: 2,
    });

    for (const moveTo of [source.id, 999999]) {
      const invalid = await t.app.inject({
        method: 'DELETE',
        url: `/api/v1/categories/${source.id}?moveTo=${moveTo}`,
        headers,
      });
      expect(invalid.json()).toMatchObject({
        status: 422,
        errors: [{ path: 'moveTo', message: 'Escolha outra categoria existente.' }],
      });
    }

    const moved = await t.app.inject({
      method: 'DELETE',
      url: `/api/v1/categories/${source.id}?moveTo=${target.id}`,
      headers,
    });
    expect(moved.statusCode).toBe(204);
    const [row] = await t.db.select().from(products).where(eq(products.id, product.id));
    expect(row).toMatchObject({ categoryId: target.id, searchText: 'consul 300l refrigeradores' });
    const [audit] = await t.db.select().from(auditLogs).where(eq(auditLogs.action, 'category.delete'));
    expect(audit).toMatchObject({ after: { movedProducts: 2, movedTo: target.id } });

    const empty = await t.app.inject({
      method: 'DELETE',
      url: `/api/v1/categories/${target.id}?moveTo=999999`,
      headers,
    });
    expect(empty.statusCode).toBe(422);
    const lonely = await createCategory(t, 'Vazia');
    const deleted = await t.app.inject({ method: 'DELETE', url: `/api/v1/categories/${lonely.id}`, headers });
    expect(deleted.statusCode).toBe(204);
    const again = await t.app.inject({ method: 'DELETE', url: `/api/v1/categories/${lonely.id}`, headers });
    expect(again.statusCode).toBe(404);
  });

  it('reorders all categories at once', async () => {
    const a = await createCategory(t, 'A', 0);
    const b = await createCategory(t, 'B', 1);
    const c = await createCategory(t, 'C', 2);
    const { headers } = await t.as('ADMIN');
    const response = await t.app.inject({
      method: 'PUT',
      url: '/api/v1/categories/order',
      headers,
      payload: { ids: [c.id, a.id, b.id] },
    });
    expect(response.json().map((category: { name: string }) => category.name)).toEqual(['C', 'A', 'B']);

    for (const ids of [
      [c.id, a.id],
      [c.id, a.id, a.id],
      [c.id, a.id, 999999],
    ]) {
      const invalid = await t.app.inject({
        method: 'PUT',
        url: '/api/v1/categories/order',
        headers,
        payload: { ids },
      });
      expect(invalid.json()).toMatchObject({ status: 422, title: 'Ordem inválida' });
    }
    const [audit] = await t.db.select().from(auditLogs).where(eq(auditLogs.action, 'category.reorder'));
    expect(audit).toMatchObject({ before: [a.id, b.id, c.id], after: [c.id, a.id, b.id] });
  });
});
