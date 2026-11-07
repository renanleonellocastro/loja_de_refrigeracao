import { expect, test } from '@playwright/test';
import { expectAccessibleSettled } from '../support/a11y.js';
import { ADMIN, MANAGER, newCustomer, signInApi } from '../support/api.js';
import { newProduct, placeOrder } from '../support/flows.js';
import { waitForEmail } from '../support/mailpit.js';
import { signIn } from '../support/session.js';
import { open } from '../support/viewport.js';

// The checkout through the cart runs in shopping.spec.ts; this file checks who is told about the new order.
test.describe(
  'RF-19 fechar pedido: emails ao cliente, aos gerentes e ao super usuário',
  { tag: '@RF-19' },
  () => {
    test('o pedido chega por email ao cliente e à gerência', async ({ page, request }, testInfo) => {
      const admin = await signInApi(request, ADMIN);
      const product = await newProduct(request, admin, `Filtro de água ${crypto.randomUUID().slice(0, 8)}`);
      const customer = await newCustomer(request, testInfo, 'Paula Pedido');
      const order = await placeOrder(request, customer, product.id);

      const receipt = await waitForEmail(request, customer.email, `Pedido ${order.number} recebido`);
      expect(receipt.text).toContain(product.name);
      expect(receipt.text).toContain('O pagamento é feito na retirada.');
      for (const staff of [MANAGER, ADMIN]) {
        const notice = await waitForEmail(request, staff, `Novo pedido ${order.number}`);
        expect(notice.text).toContain('Paula Pedido');
      }

      await signIn(page, customer.email);
      await open(page, `/minha-conta/pedidos/${order.id}`);
      await expect(page.getByText(order.number).first()).toBeVisible();
      await expectAccessibleSettled(page);
    });
  },
);
