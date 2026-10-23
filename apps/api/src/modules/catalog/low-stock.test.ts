import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { notifications, products } from '../../infra/db/schema.js';
import { createCategory, createProduct } from '../../../test/catalog.js';
import { useTestApp } from '../../../test/harness.js';
import { crossesMinimum } from './low-stock.js';
import { reserveStock } from './service.js';

describe('low stock crossing', () => {
  it('fires only when the quantity goes from the minimum or above to below it', () => {
    expect(crossesMinimum(2, 1, 2)).toBe(true);
    expect(crossesMinimum(5, 0, 2)).toBe(true);
    expect(crossesMinimum(5, 2, 2)).toBe(false);
    expect(crossesMinimum(1, 0, 2)).toBe(false);
    expect(crossesMinimum(1, 3, 2)).toBe(false);
  });
});

describe('low stock notification', () => {
  const t = useTestApp();

  async function setup(stockMin: number | null = 2) {
    const category = await createCategory(t, 'Freezers');
    const author = await t.as('MANAGER');
    const admin = await t.as('ADMIN');
    const employee = await t.as('EMPLOYEE');
    const product = await createProduct(t, author.headers, {
      categoryId: category.id,
      name: 'Freezer Horizontal Metalfrio',
      initialStock: 5,
      stockMin,
    });
    return { author, admin, employee, product };
  }

  const move = (productId: number, headers: Record<string, string>, payload: object) =>
    t.app.inject({ method: 'POST', url: `/api/v1/products/${productId}/stock-movements`, headers, payload });

  const lowStockNoticesOf = (userId: number) =>
    t.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.type, 'product.lowStock')));

  it('tells the management once when a movement takes the product below the minimum', async () => {
    const { author, admin, employee, product } = await setup();
    const loss = (quantity: number) =>
      move(product.id, author.headers, { type: 'LOSS', quantity, reason: 'Avariado' });
    expect((await loss(3)).json()).toMatchObject({ stockAvailable: 2, lowStock: false });
    expect(await lowStockNoticesOf(admin.user.id)).toEqual([]);

    expect((await loss(1)).json()).toMatchObject({ stockAvailable: 1, lowStock: true });
    await loss(1);
    expect(await lowStockNoticesOf(admin.user.id)).toMatchObject([
      {
        title: 'Estoque baixo: Freezer Horizontal Metalfrio',
        body: 'Restam 1 unidade(s), abaixo do mínimo de 2. Registre a entrada no estoque quando a reposição chegar.',
        link: `/produtos/gerenciar/${product.id}`,
      },
    ]);
    expect(await lowStockNoticesOf(author.user.id)).toEqual([]);
    expect(await lowStockNoticesOf(employee.user.id)).toEqual([]);
    await t.deliverEmails();
    expect(t.lastEmailTo(admin.user.email)).toMatchObject({
      subject: 'Estoque baixo: Freezer Horizontal Metalfrio',
    });
    expect(t.lastEmailTo(admin.user.email)?.text).toContain(`/produtos/gerenciar/${product.id}`);

    await move(product.id, author.headers, { type: 'IN', quantity: 4 });
    await loss(3);
    expect(await lowStockNoticesOf(admin.user.id)).toHaveLength(2);
  });

  it('uses the store default minimum and stays quiet for archived products', async () => {
    const { author, admin, product } = await setup(null);
    await move(product.id, author.headers, { type: 'ADJUSTMENT', quantity: -4, reason: 'Inventário' });
    expect(await lowStockNoticesOf(admin.user.id)).toEqual([]);
    await t.db.update(products).set({ archivedAt: t.clock.now() }).where(eq(products.id, product.id));
    await move(product.id, author.headers, { type: 'LOSS', quantity: 1, reason: 'Quebrou' });
    expect(await lowStockNoticesOf(admin.user.id)).toEqual([]);
  });

  it('alerts the whole management when an order reservation crosses the minimum', async () => {
    const { author, admin, product } = await setup();
    await t.db.transaction((tx) =>
      reserveStock(t.ctx, tx, [{ productId: product.id, quantity: 4 }], {}, t.clock.now()),
    );
    expect(await lowStockNoticesOf(admin.user.id)).toHaveLength(1);
    expect(await lowStockNoticesOf(author.user.id)).toMatchObject([
      { body: expect.stringContaining('Restam 1 unidade(s)') },
    ]);
  });
});
