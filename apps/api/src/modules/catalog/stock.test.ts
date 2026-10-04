import { asc, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { auditLogs, products, stockMovements } from '../../infra/db/schema.js';
import { createCategory, createProduct } from '../../../test/catalog.js';
import { useTestApp } from '../../../test/harness.js';
import { insufficientStock, productsForOrder, releaseStock, reserveStock } from './service.js';
import { deltaOf } from './stock.js';

describe('stock deltas', () => {
  it('adds entries, subtracts losses and applies signed adjustments', () => {
    expect(deltaOf({ type: 'IN', quantity: 3 })).toBe(3);
    expect(deltaOf({ type: 'LOSS', quantity: 3 })).toBe(-3);
    expect(deltaOf({ type: 'ADJUSTMENT', quantity: -2 })).toBe(-2);
  });

  it('describes missing stock like docs/API.md', () => {
    expect(insufficientStock([{ productId: 1, requested: 3, available: 1 }]).toProblem()).toMatchObject({
      status: 409,
      detail: 'Alguns itens não têm a quantidade pedida disponível.',
      items: [{ productId: 1, requested: 3, available: 1 }],
    });
  });
});

describe('stock movements', () => {
  const t = useTestApp();

  async function setup(initialStock = 5, stockMin: number | null = 2) {
    const category = await createCategory(t, 'Freezers');
    const manager = await t.as('MANAGER');
    const product = await createProduct(t, manager.headers, {
      categoryId: category.id,
      name: 'Freezer Horizontal Metalfrio',
      initialStock,
      stockMin,
    });
    return { manager, product };
  }

  const move = (productId: number, headers: Record<string, string>, payload: object) =>
    t.app.inject({ method: 'POST', url: `/api/v1/products/${productId}/stock-movements`, headers, payload });

  const stockOf = async (id: number) =>
    (await t.db.select().from(products).where(eq(products.id, id)))[0]!.stockAvailable;

  it('records entries, adjustments and losses with author, reason and audit', async () => {
    const { manager, product } = await setup();
    const entry = await move(product.id, manager.headers, { type: 'IN', quantity: 4 });
    expect(entry.statusCode).toBe(201);
    expect(entry.headers.location).toBe(`/api/v1/products/${product.id}/stock-movements`);
    expect(entry.json()).toMatchObject({
      movement: {
        type: 'IN',
        quantity: 4,
        reason: null,
        authorId: manager.user.id,
        authorName: manager.user.name,
      },
      stockAvailable: 9,
      lowStock: false,
    });
    const adjustment = await move(product.id, manager.headers, {
      type: 'ADJUSTMENT',
      quantity: -2,
      reason: 'Contagem do inventário',
    });
    expect(adjustment.json()).toMatchObject({ movement: { quantity: -2 }, stockAvailable: 7 });
    const loss = await move(product.id, manager.headers, {
      type: 'LOSS',
      quantity: 6,
      reason: 'Avariado no transporte',
    });
    expect(loss.json()).toMatchObject({
      movement: { type: 'LOSS', quantity: -6 },
      stockAvailable: 1,
      lowStock: true,
    });

    const [audit] = await t.db.select().from(auditLogs).where(eq(auditLogs.action, 'product.stock'));
    expect(audit).toMatchObject({
      actorId: manager.user.id,
      before: { stockAvailable: 5 },
      after: { stockAvailable: 9, type: 'IN', quantity: 4 },
    });
  });

  it('refuses movements that would make the stock negative', async () => {
    const { manager, product } = await setup(2);
    const response = await move(product.id, manager.headers, {
      type: 'LOSS',
      quantity: 3,
      reason: 'Quebrou',
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      type: expect.stringContaining('insufficient-stock'),
      items: [{ productId: product.id, requested: 3, available: 2 }],
    });
    expect(await stockOf(product.id)).toBe(2);
    expect(await t.db.select().from(stockMovements).where(eq(stockMovements.type, 'LOSS'))).toEqual([]);
  });

  it('validates quantity and reason in Portuguese', async () => {
    const { manager, product } = await setup();
    const errorsOf = async (payload: object) =>
      (await move(product.id, manager.headers, payload)).json().errors;
    expect(await errorsOf({ type: 'IN', quantity: 0 })).toEqual([
      { path: 'quantity', message: 'Informe uma quantidade maior que zero.' },
    ]);
    expect(await errorsOf({ type: 'ADJUSTMENT', quantity: 0, reason: '  ' })).toEqual([
      { path: 'quantity', message: 'Informe uma quantidade diferente de zero (negativa para retirar).' },
      { path: 'reason', message: 'Informe o motivo.' },
    ]);
    expect(await errorsOf({ type: 'SALE', quantity: 1 })).toEqual([
      { path: 'type', message: 'Escolha entrada, ajuste ou perda.' },
    ]);
    expect((await move(999999, manager.headers, { type: 'IN', quantity: 1 })).statusCode).toBe(404);
  });

  it('never goes negative under concurrent losses', async () => {
    const { manager, product } = await setup(5);
    const responses = await Promise.all(
      Array.from({ length: 20 }, () =>
        move(product.id, manager.headers, { type: 'LOSS', quantity: 1, reason: 'Teste de concorrência' }),
      ),
    );
    const codes = responses.map((r) => r.statusCode);
    expect(codes.filter((code) => code === 201)).toHaveLength(5);
    expect(codes.filter((code) => code === 409)).toHaveLength(15);
    expect(await stockOf(product.id)).toBe(0);
    expect(await t.db.select().from(stockMovements).where(eq(stockMovements.type, 'LOSS'))).toHaveLength(5);
  });

  it('lists the history newest first with the author name', async () => {
    const { manager, product } = await setup(5);
    t.clock.advance(60_000);
    await move(product.id, manager.headers, { type: 'IN', quantity: 1 });
    await t.db.insert(stockMovements).values({
      productId: product.id,
      type: 'RESERVATION',
      quantity: -1,
      createdAt: new Date(t.clock.now().getTime() + 60_000),
    });
    const list = (query = '') =>
      t.app.inject({
        method: 'GET',
        url: `/api/v1/products/${product.id}/stock-movements${query}`,
        headers: manager.headers,
      });
    const response = await list('?pageSize=2');
    expect(response.json()).toMatchObject({
      meta: { page: 1, pageSize: 2, total: 3 },
      data: [
        { type: 'RESERVATION', authorName: null },
        { type: 'IN', quantity: 1, authorName: manager.user.name },
      ],
    });
    expect((await list('?page=2&pageSize=2')).json().data).toMatchObject([{ reason: 'Estoque inicial' }]);
    const missing = await t.app.inject({
      method: 'GET',
      url: '/api/v1/products/999999/stock-movements',
      headers: manager.headers,
    });
    expect(missing.statusCode).toBe(404);
  });
});

describe('stock for orders (catalog service)', () => {
  const t = useTestApp();

  async function products3() {
    const category = await createCategory(t, 'Bebedouros');
    const { headers } = await t.as('MANAGER');
    const create = (name: string, initialStock: number) =>
      createProduct(t, headers, { categoryId: category.id, name, initialStock, priceCents: 59_900 });
    const a = await create('Bebedouro Libell', 3);
    const b = await create('Bebedouro Esmaltec', 1);
    return [a, b, await create('Purificador', 2)] as const;
  }

  it('reserves every item atomically, summing repeated products', async () => {
    const [a, b] = await products3();
    const unavailable = await t.db.transaction((tx) =>
      reserveStock(
        tx,
        [
          { productId: a.id, quantity: 1 },
          { productId: b.id, quantity: 1 },
          { productId: a.id, quantity: 2 },
        ],
        { authorId: null },
        t.clock.now(),
      ),
    );
    expect(unavailable).toEqual([]);
    expect(await reserveStock(t.db, [], {}, t.clock.now())).toEqual([]);
    const movements = await t.db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.type, 'RESERVATION'))
      .orderBy(asc(stockMovements.productId));
    expect(movements.map((m) => [m.productId, m.quantity])).toEqual([
      [a.id, -3],
      [b.id, -1],
    ]);
    const [rowA] = await t.db.select().from(products).where(eq(products.id, a.id));
    expect(rowA!.stockAvailable).toBe(0);
  });

  it('reports missing, archived and short items, leaving the rollback to the caller', async () => {
    const [a, b, c] = await products3();
    await t.db.update(products).set({ archivedAt: t.clock.now() }).where(eq(products.id, c.id));
    const failure = await t.db
      .transaction(async (tx) => {
        const unavailable = await reserveStock(
          tx,
          [
            { productId: a.id, quantity: 1 },
            { productId: b.id, quantity: 2 },
            { productId: c.id, quantity: 1 },
            { productId: 999999, quantity: 1 },
          ],
          {},
          t.clock.now(),
        );
        throw insufficientStock(unavailable);
      })
      .catch((error: unknown) => error);
    expect(failure).toMatchObject({
      status: 409,
      extensions: {
        items: [
          { productId: b.id, requested: 2, available: 1 },
          { productId: c.id, requested: 1, available: 0 },
          { productId: 999999, requested: 1, available: 0 },
        ],
      },
    });
    const [rowA] = await t.db.select().from(products).where(eq(products.id, a.id));
    expect(rowA!.stockAvailable).toBe(3);
    expect(await t.db.select().from(stockMovements).where(eq(stockMovements.type, 'RESERVATION'))).toEqual(
      [],
    );
  });

  it('gives exactly one of many concurrent orders the last unit', async () => {
    const [, b] = await products3();
    const attempts = await Promise.all(
      Array.from({ length: 8 }, () =>
        t.db
          .transaction(async (tx) => {
            const unavailable = await reserveStock(tx, [{ productId: b.id, quantity: 1 }], {}, t.clock.now());
            if (unavailable.length > 0) throw insufficientStock(unavailable);
            return 'reserved';
          })
          .catch(() => 'refused'),
      ),
    );
    expect(attempts.filter((a) => a === 'reserved')).toHaveLength(1);
    const [row] = await t.db.select().from(products).where(eq(products.id, b.id));
    expect(row!.stockAvailable).toBe(0);
  });

  it('releases reserved stock with RELEASE movements', async () => {
    const [a] = await products3();
    await t.db.transaction(async (tx) => {
      await reserveStock(tx, [{ productId: a.id, quantity: 2 }], {}, t.clock.now());
      await releaseStock(tx, [{ productId: a.id, quantity: 2 }], { authorId: null }, t.clock.now());
    });
    const [row] = await t.db.select().from(products).where(eq(products.id, a.id));
    expect(row!.stockAvailable).toBe(3);
    const released = await t.db.select().from(stockMovements).where(eq(stockMovements.type, 'RELEASE'));
    expect(released).toMatchObject([{ productId: a.id, quantity: 2 }]);
  });

  it('loads names and prices of the products of an order', async () => {
    const [a, b] = await products3();
    await t.db.update(products).set({ archivedAt: t.clock.now() }).where(eq(products.id, b.id));
    const rows = await productsForOrder(t.db, [a.id, b.id, a.id, 999999]);
    expect(rows.sort((x, y) => x.id - y.id)).toEqual([
      {
        id: a.id,
        name: 'Bebedouro Libell',
        slug: 'bebedouro-libell',
        priceCents: 59_900,
        stockAvailable: 3,
        archived: false,
        cover: null,
      },
      {
        id: b.id,
        name: 'Bebedouro Esmaltec',
        slug: 'bebedouro-esmaltec',
        priceCents: 59_900,
        stockAvailable: 1,
        archived: true,
        cover: null,
      },
    ]);
    expect(await productsForOrder(t.db, [])).toEqual([]);
  });
});
