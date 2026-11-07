import { expect, test } from '@playwright/test';
import { ADMIN, MANAGER, newCustomer, signInApi } from '../support/api.js';
import { newProduct, sellAtCounter } from '../support/flows.js';
import { waitForEmail } from '../support/mailpit.js';

// The counter sale screen runs in staff-catalog-orders.spec.ts; this file checks the emails it sends.
test.describe('RF-22 vender no balcão: email ao comprador e à gerência', { tag: '@RF-22' }, () => {
  test('a venda no balcão chega por email ao comprador e à gerência', async ({ request }, testInfo) => {
    const admin = await signInApi(request, ADMIN);
    const manager = await signInApi(request, MANAGER);
    const product = await newProduct(request, admin, `Gás R600a ${crypto.randomUUID().slice(0, 8)}`);
    const customer = await newCustomer(request, testInfo, 'Bento Balcão');
    const sale = await sellAtCounter(request, manager, customer, product.id);

    const receipt = await waitForEmail(request, customer.email, `Sua compra ${sale.number}`);
    expect(receipt.text).toContain(product.name);
    const notice = await waitForEmail(request, ADMIN, `Venda no balcão ${sale.number}`);
    expect(notice.text).toContain('Bento Balcão');
  });
});
