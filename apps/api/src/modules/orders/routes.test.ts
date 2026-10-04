import { eq } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import { beforeEach, describe, expect, it } from 'vitest';
import { auditLogs, notifications, products, stockMovements } from '../../infra/db/schema.js';
import { createCategory, createProduct } from '../../../test/catalog.js';
import { useTestApp } from '../../../test/harness.js';

describe('cart and orders', () => {
  const t = useTestApp();
  let staff: Record<string, string>;
  let geladeira: { id: number };
  let lavadora: { id: number };

  beforeEach(async () => {
    staff = (await t.as('MANAGER')).headers;
    const category = await createCategory(t, 'Eletrodomésticos');
    geladeira = await createProduct(t, staff, {
      categoryId: category.id,
      name: 'Geladeira Consul',
      priceCents: 250_000,
      initialStock: 3,
    });
    lavadora = await createProduct(t, staff, {
      categoryId: category.id,
      name: 'Lavadora Electrolux',
      priceCents: 180_000,
      initialStock: 1,
    });
  });

  const put = (headers: Record<string, string>, productId: number, quantity: number) =>
    t.app.inject({
      method: 'PUT',
      url: `/api/v1/me/cart/items/${productId}`,
      headers,
      payload: { quantity },
    });

  const stockOf = async (id: number) =>
    (await t.db.select().from(products).where(eq(products.id, id)))[0]!.stockAvailable;

  describe('cart', () => {
    it('keeps quantities limited to the stock, with live totals', async () => {
      const { headers } = await t.as('CLIENT');
      const first = await put(headers, geladeira.id, 2);
      expect(first.json()).toMatchObject({ itemCount: 2, totalCents: 500_000, ready: true });
      expect(first.json().items[0]).toMatchObject({
        product: { name: 'Geladeira Consul', cover: null },
        problem: null,
      });
      const tooMany = await put(headers, geladeira.id, 4);
      expect(tooMany.json()).toMatchObject({ status: 409, title: 'Estoque insuficiente' });
      await put(headers, lavadora.id, 1);
      const removed = await t.app.inject({
        method: 'DELETE',
        url: `/api/v1/me/cart/items/${lavadora.id}`,
        headers,
      });
      expect(removed.json().items).toHaveLength(1);
      expect((await put(headers, 999999, 1)).statusCode).toBe(404);
      const empty = await t.as('CLIENT');
      const view = await t.app.inject({ method: 'GET', url: '/api/v1/me/cart', headers: empty.headers });
      expect(view.json()).toEqual({ items: [], itemCount: 0, totalCents: 0, ready: false });
    });

    it('flags lines that became unavailable or short', async () => {
      const { headers } = await t.as('CLIENT');
      await put(headers, geladeira.id, 3);
      await put(headers, lavadora.id, 1);
      await t.db.update(products).set({ stockAvailable: 1 }).where(eq(products.id, geladeira.id));
      await t.db.update(products).set({ archivedAt: new Date() }).where(eq(products.id, lavadora.id));
      const view = await t.app.inject({ method: 'GET', url: '/api/v1/me/cart', headers });
      expect(view.json().items.map((i: { problem: string }) => i.problem)).toEqual([
        'insufficient',
        'unavailable',
      ]);
      await t.db.update(products).set({ stockAvailable: 0 }).where(eq(products.id, geladeira.id));
      const soldOut = await t.app.inject({ method: 'GET', url: '/api/v1/me/cart', headers });
      expect(soldOut.json().items[0].problem).toBe('unavailable');
      expect(view.json().ready).toBe(false);
      await t.db.delete(products).where(eq(products.id, lavadora.id));
      const pruned = await t.app.inject({ method: 'GET', url: '/api/v1/me/cart', headers });
      expect(pruned.json().items).toHaveLength(1);
    });

    it('merges the visitor cart, capped by stock, ignoring unavailable products', async () => {
      const { headers } = await t.as('CLIENT');
      await put(headers, geladeira.id, 1);
      await t.db.update(products).set({ stockAvailable: 0 }).where(eq(products.id, lavadora.id));
      const category = await createCategory(t, 'Outros');
      const archived = await createProduct(t, staff, {
        categoryId: category.id,
        name: 'Arquivado',
        initialStock: 2,
      });
      await t.db.update(products).set({ archivedAt: new Date() }).where(eq(products.id, archived.id));
      const freezer = await createProduct(t, staff, {
        categoryId: category.id,
        name: 'Freezer',
        initialStock: 2,
      });
      const merged = await t.app.inject({
        method: 'POST',
        url: '/api/v1/me/cart/merge',
        headers,
        payload: {
          items: [
            { productId: geladeira.id, quantity: 5 },
            { productId: lavadora.id, quantity: 1 },
            { productId: 999999, quantity: 1 },
            { productId: archived.id, quantity: 1 },
            { productId: freezer.id, quantity: 1 },
          ],
        },
      });
      expect(
        merged
          .json()
          .items.map((i: { product: { id: number }; quantity: number }) => [i.product.id, i.quantity]),
      ).toEqual([
        [geladeira.id, 3],
        [freezer.id, 1],
      ]);
    });

    it('limits the number of different products', async () => {
      const { headers, user } = await t.as('CLIENT');
      const category = await createCategory(t, 'Peças');
      const ids: number[] = [];
      for (let i = 0; i < 51; i += 1) {
        ids.push(
          (await createProduct(t, staff, { categoryId: category.id, name: `Peça ${i}`, initialStock: 5 })).id,
        );
      }
      const { setCartItem } = await import('./repository.js');
      for (const id of ids.slice(0, 50)) await setCartItem(t.db, user.id, id, 1, t.clock.now());
      expect((await put(headers, ids[50]!, 1)).json().title).toBe('Carrinho cheio');
      expect((await put(headers, ids[0]!, 2)).statusCode).toBe(200);
      const merged = await t.app.inject({
        method: 'POST',
        url: '/api/v1/me/cart/merge',
        headers,
        payload: { items: [{ productId: ids[50], quantity: 1 }] },
      });
      expect(merged.json().items).toHaveLength(50);
    });
  });

  describe('checkout', () => {
    it('freezes prices, reserves stock, empties the cart and notifies everyone', async () => {
      const manager = await t.createUser('MANAGER');
      const { headers, user } = await t.as('CLIENT');
      await put(headers, geladeira.id, 2);
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers,
        payload: { notes: 'Retiro sábado' },
      });
      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        number: expect.stringMatching(/^RC-\d{6}$/),
        status: 'PENDING_REVIEW',
        statusLabel: 'Em análise',
        channel: 'ONLINE',
        totalCents: 500_000,
        notes: 'Retiro sábado',
        items: [
          { productName: 'Geladeira Consul', unitPriceCents: 250_000, quantity: 2, subtotalCents: 500_000 },
        ],
        events: [{ fromStatus: null, toStatus: 'PENDING_REVIEW', actor: { id: user.id } }],
        canCancel: true,
      });
      expect(await stockOf(geladeira.id)).toBe(1);
      const cart = await t.app.inject({ method: 'GET', url: '/api/v1/me/cart', headers });
      expect(cart.json().items).toEqual([]);
      const movements = await t.db
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.type, 'RESERVATION'));
      expect(movements[0]).toMatchObject({ quantity: -2, orderId: response.json().id });
      await t.deliverEmails();
      expect(t.lastEmailTo(user.email)?.text).toContain('Total: R$ 5.000,00.');
      expect(t.lastEmailTo(manager.email)?.subject).toBe(`Novo pedido ${response.json().number}`);
      await t.db.update(products).set({ priceCents: 1 }).where(eq(products.id, geladeira.id));
      const again = await t.app.inject({
        method: 'GET',
        url: `/api/v1/orders/${response.json().id}`,
        headers,
      });
      expect(again.json().totalCents).toBe(500_000);
    });

    it('rolls everything back when an item ran out, listing it', async () => {
      const a = await t.as('CLIENT');
      const b = await t.as('CLIENT');
      await put(a.headers, lavadora.id, 1);
      await put(a.headers, geladeira.id, 1);
      await put(b.headers, lavadora.id, 1);
      expect(
        (await t.app.inject({ method: 'POST', url: '/api/v1/orders', headers: b.headers, payload: {} }))
          .statusCode,
      ).toBe(201);
      const late = await t.app.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: a.headers,
        payload: {},
      });
      expect(late.json()).toMatchObject({
        status: 409,
        items: [{ productId: lavadora.id, requested: 1, available: 0 }],
      });
      expect(await stockOf(geladeira.id)).toBe(3);
      const cart = await t.app.inject({ method: 'GET', url: '/api/v1/me/cart', headers: a.headers });
      expect(cart.json().items).toHaveLength(2);
    });

    it('sells the last unit to exactly one of many simultaneous buyers', async () => {
      const buyers = await Promise.all(Array.from({ length: 6 }, () => t.as('CLIENT')));
      for (const buyer of buyers) await put(buyer.headers, lavadora.id, 1);
      const results = await Promise.all(
        buyers.map((buyer) =>
          t.app.inject({ method: 'POST', url: '/api/v1/orders', headers: buyer.headers, payload: {} }),
        ),
      );
      expect(results.filter((r) => r.statusCode === 201)).toHaveLength(1);
      expect(results.filter((r) => r.statusCode === 409)).toHaveLength(5);
      expect(await stockOf(lavadora.id)).toBe(0);
    });

    it('refuses an empty cart and archived products', async () => {
      const { headers } = await t.as('CLIENT');
      expect(
        (await t.app.inject({ method: 'POST', url: '/api/v1/orders', headers, payload: {} })).json().title,
      ).toBe('Carrinho vazio');
      await put(headers, lavadora.id, 1);
      await t.db.update(products).set({ archivedAt: new Date() }).where(eq(products.id, lavadora.id));
      const archived = await t.app.inject({ method: 'POST', url: '/api/v1/orders', headers, payload: {} });
      expect(archived.json()).toMatchObject({
        status: 409,
        items: [{ productId: lavadora.id, available: 0 }],
      });
    });

    it('lets management order on behalf of a customer with explicit items', async () => {
      const customer = await t.createUser('CLIENT');
      const noItems = await t.app.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: staff,
        payload: { customerId: customer.id },
      });
      expect(noItems.json().title).toBe('Itens obrigatórios');
      const employee = await t.createUser('EMPLOYEE');
      const notCustomer = await t.app.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: staff,
        payload: { customerId: employee.id, items: [{ productId: geladeira.id, quantity: 1 }] },
      });
      expect(notCustomer.json().title).toBe('Cliente inválido');
      const ok = await t.app.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: { ...staff, 'idempotency-key': 'pedido-balcao-001' },
        payload: {
          customerId: customer.id,
          items: [
            { productId: geladeira.id, quantity: 1 },
            { productId: geladeira.id, quantity: 1 },
          ],
        },
      });
      expect(ok.json()).toMatchObject({ customer: { id: customer.id }, items: [{ quantity: 2 }] });
      const replay = await t.app.inject({
        method: 'POST',
        url: '/api/v1/orders',
        headers: { ...staff, 'idempotency-key': 'pedido-balcao-001' },
        payload: {
          customerId: customer.id,
          items: [
            { productId: geladeira.id, quantity: 1 },
            { productId: geladeira.id, quantity: 1 },
          ],
        },
      });
      expect(replay.json(), replay.body).toMatchObject({ id: ok.json().id });
      expect(await stockOf(geladeira.id)).toBe(1);
      expect((await t.db.select().from(auditLogs)).map((a) => a.action)).toContain('order.create');
    });
  });

  describe('order lifecycle', () => {
    async function placed() {
      const customer = await t.as('CLIENT');
      await put(customer.headers, geladeira.id, 1);
      const order = (
        await t.app.inject({ method: 'POST', url: '/api/v1/orders', headers: customer.headers, payload: {} })
      ).json();
      return { customer, id: order.id as number, number: order.number as string };
    }

    it('goes from review to ready to picked up with a timeline and notices', async () => {
      const { customer, id, number } = await placed();
      const ready = await t.app.inject({
        method: 'POST',
        url: `/api/v1/orders/${id}/ready-for-pickup`,
        headers: staff,
      });
      expect(ready.json()).toMatchObject({ status: 'READY_FOR_PICKUP', canCancel: true });
      await t.deliverEmails();
      expect(t.lastEmailTo(customer.user.email)?.subject).toBe(`Pedido ${number} pronto para retirada`);
      const picked = await t.app.inject({
        method: 'POST',
        url: `/api/v1/orders/${id}/pickup`,
        headers: staff,
      });
      expect(picked.json()).toMatchObject({ status: 'PICKED_UP', canCancel: false });
      expect(picked.json().events.map((e: { label: string }) => e.label)).toEqual([
        'Em análise',
        'Aguardando retirada',
        'Retirado',
      ]);
      const again = await t.app.inject({
        method: 'POST',
        url: `/api/v1/orders/${id}/pickup`,
        headers: staff,
      });
      expect(again.json()).toMatchObject({ status: 409, title: 'Ação indisponível' });
      const inbox = await t.db.select().from(notifications).where(eq(notifications.userId, customer.user.id));
      expect(inbox.map((n) => n.type)).toEqual(['order', 'order', 'order']);
    });

    it('lets the customer cancel only while in review, returning the stock', async () => {
      const manager = await t.createUser('MANAGER');
      const { customer, id } = await placed();
      const canceled = await t.app.inject({
        method: 'POST',
        url: `/api/v1/orders/${id}/cancellation`,
        headers: customer.headers,
        payload: { reason: 'Comprei em outro lugar' },
      });
      expect(canceled.json()).toMatchObject({
        status: 'CANCELED',
        events: [{}, { reason: 'Comprei em outro lugar' }],
      });
      expect(await stockOf(geladeira.id)).toBe(3);
      await t.deliverEmails();
      expect(t.lastEmailTo(manager.email)?.text).toContain('Comprei em outro lugar');

      const second = await placed();
      await t.app.inject({
        method: 'POST',
        url: `/api/v1/orders/${second.id}/ready-for-pickup`,
        headers: staff,
      });
      const late = await t.app.inject({
        method: 'POST',
        url: `/api/v1/orders/${second.id}/cancellation`,
        headers: second.customer.headers,
        payload: {},
      });
      expect(late.statusCode).toBe(409);
      const detail = await t.app.inject({
        method: 'GET',
        url: `/api/v1/orders/${second.id}`,
        headers: second.customer.headers,
      });
      expect(detail.json().canCancel).toBe(false);
      const byStore = await t.app.inject({
        method: 'POST',
        url: `/api/v1/orders/${second.id}/cancellation`,
        headers: staff,
        payload: {},
      });
      expect(byStore.json().status).toBe('CANCELED');
      await t.deliverEmails();
      expect(t.lastEmailTo(second.customer.user.email)?.text).toContain('A loja cancelou este pedido.');
      const third = await placed();
      await t.app.inject({
        method: 'POST',
        url: `/api/v1/orders/${third.id}/cancellation`,
        headers: third.customer.headers,
        payload: {},
      });
      await t.deliverEmails();
      expect(t.lastEmailTo(manager.email)?.text).toContain('O cliente não informou o motivo.');
    });

    it('hides other customers orders and lists with counts and search for management', async () => {
      const a = await placed();
      const b = await placed();
      expect(
        (await t.app.inject({ method: 'GET', url: `/api/v1/orders/${a.id}`, headers: b.customer.headers }))
          .statusCode,
      ).toBe(404);
      const own = await t.app.inject({
        method: 'GET',
        url: '/api/v1/orders?q=qualquer',
        headers: a.customer.headers,
      });
      expect(own.json().data.map((o: { id: number }) => o.id)).toEqual([a.id]);
      await t.app.inject({ method: 'POST', url: `/api/v1/orders/${a.id}/ready-for-pickup`, headers: staff });
      const queue = await t.app.inject({
        method: 'GET',
        url: '/api/v1/orders?status=PENDING_REVIEW',
        headers: staff,
      });
      expect(queue.json().meta).toMatchObject({
        total: 1,
        counts: { PENDING_REVIEW: 1, READY_FOR_PICKUP: 1, PICKED_UP: 0, CANCELED: 0 },
      });
      expect(queue.json().data[0]).toMatchObject({
        id: b.id,
        itemCount: 1,
        customer: { id: b.customer.user.id },
      });
      const byNumber = await t.app.inject({
        method: 'GET',
        url: `/api/v1/orders?q=${a.number}`,
        headers: staff,
      });
      expect(byNumber.json().data.map((o: { id: number }) => o.id)).toEqual([a.id]);
      const byName = await t.app.inject({
        method: 'GET',
        url: `/api/v1/orders?q=${encodeURIComponent(b.customer.user.name)}`,
        headers: staff,
      });
      expect(byName.json().data.map((o: { id: number }) => o.id)).toEqual([b.id]);
      const range = await t.app.inject({
        method: 'GET',
        url: '/api/v1/orders?from=2000-01-01&to=2001-01-01',
        headers: staff,
      });
      expect(range.json().meta.total).toBe(0);
    });

    it('prints a separation label as PDF', async () => {
      const { id, number } = await placed();
      const response = await t.app.inject({
        method: 'GET',
        url: `/api/v1/orders/${id}/label`,
        headers: staff,
      });
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toBe(`inline; filename="etiqueta-${number}.pdf"`);
      const pdf = await PDFDocument.load(response.rawPayload);
      expect(pdf.getTitle()).toBe(`Etiqueta ${number}`);
    });

    it('shows removed customers and still works', async () => {
      const { customer, id } = await placed();
      const { anonymizeUser } = await import('../users/service.js');
      await anonymizeUser(t.db, customer.user.id, t.clock.now());
      const detail = await t.app.inject({ method: 'GET', url: `/api/v1/orders/${id}`, headers: staff });
      expect(detail.json().customer).toEqual({
        id: customer.user.id,
        name: 'Conta removida',
        email: '',
        phone: null,
      });
      const list = await t.app.inject({ method: 'GET', url: '/api/v1/orders', headers: staff });
      expect(list.json().data[0].customer.name).toBe('Conta removida');
      const label = await t.app.inject({ method: 'GET', url: `/api/v1/orders/${id}/label`, headers: staff });
      expect(label.statusCode).toBe(200);
      const ready = await t.app.inject({
        method: 'POST',
        url: `/api/v1/orders/${id}/ready-for-pickup`,
        headers: staff,
      });
      expect(ready.statusCode).toBe(200);
    });
  });

  describe('employees buying for themselves', () => {
    it('shows their own order without the cancel action and system events without actor', async () => {
      const employee = await t.as('EMPLOYEE');
      await put(employee.headers, geladeira.id, 1);
      const order = (
        await t.app.inject({ method: 'POST', url: '/api/v1/orders', headers: employee.headers, payload: {} })
      ).json();
      expect(order.canCancel).toBe(false);
      const { insertOrderEvent } = await import('./repository.js');
      await insertOrderEvent(t.db, {
        orderId: order.id,
        fromStatus: 'PENDING_REVIEW',
        toStatus: 'CANCELED',
        actorId: null,
        reason: 'Sistema',
        createdAt: new Date('2026-10-06T12:00:00Z'),
      });
      const detail = await t.app.inject({
        method: 'GET',
        url: `/api/v1/orders/${order.id}`,
        headers: employee.headers,
      });
      expect(detail.json().events[1]).toMatchObject({ actor: null, reason: 'Sistema' });
    });

    it('shows the product cover photo in the cart', async () => {
      const { jpeg } = await import('../../../test/images.js');
      const { multipart } = await import('../../../test/multipart.js');
      const body = multipart([
        { name: 'fotos', value: await jpeg(800, 600), filename: 'g.jpg', contentType: 'image/jpeg' },
      ]);
      const upload = await t.app.inject({
        method: 'POST',
        url: `/api/v1/products/${geladeira.id}/images`,
        payload: body.payload,
        headers: { ...staff, ...body.headers },
      });
      expect(upload.statusCode).toBeLessThan(300);
      const { headers } = await t.as('CLIENT');
      const view = await put(headers, geladeira.id, 1);
      expect(view.json().items[0].product.cover).toMatchObject({ width: 800, height: 600 });
    });
  });

  describe('counter sale', () => {
    it('sells and takes the stock out at once, with a receipt', async () => {
      const customer = await t.createUser('CLIENT');
      const employee = await t.as('EMPLOYEE');
      const response = await t.app.inject({
        method: 'POST',
        url: '/api/v1/counter-sales',
        headers: employee.headers,
        payload: {
          customerId: customer.id,
          items: [{ productId: lavadora.id, quantity: 1 }],
          notes: 'Pago no Pix',
        },
      });
      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({ channel: 'COUNTER', status: 'PICKED_UP', totalCents: 180_000 });
      expect(await stockOf(lavadora.id)).toBe(0);
      await t.deliverEmails();
      expect(t.lastEmailTo(customer.email)?.subject).toBe(`Sua compra ${response.json().number}`);
      const out = await t.app.inject({
        method: 'POST',
        url: '/api/v1/counter-sales',
        headers: employee.headers,
        payload: { customerId: customer.id, items: [{ productId: lavadora.id, quantity: 1 }] },
      });
      expect(out.statusCode).toBe(409);
      const own = await t.app.inject({
        method: 'GET',
        url: `/api/v1/orders/${response.json().id}`,
        headers: employee.headers,
      });
      expect(own.statusCode).toBe(404);
    });
  });

  describe('long product names on the label', () => {
    it('wraps names and stops before the footer', async () => {
      const { orderLabelPdf } = await import('./label.js');
      const pdf = await orderLabelPdf({
        number: 'RC-000001',
        customerName: 'Maria Aparecida dos Santos Oliveira Pereira da Silva Costa',
        customerPhone: '(19) 99999-0000',
        createdAt: new Date('2026-10-05T12:00:00Z'),
        totalCents: 100,
        items: Array.from({ length: 30 }, (_, i) => ({
          productName: `Produto com um nome bem comprido número ${i} para quebrar linha`,
          quantity: 1,
        })),
      });
      expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
    });
  });
});
