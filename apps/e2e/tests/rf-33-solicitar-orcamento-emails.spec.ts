import { expect, test } from '@playwright/test';
import { ADMIN, MANAGER, newCustomer, signInApi } from '../support/api.js';
import { answerQuote, FRIDGE_REPAIR, requestQuote } from '../support/flows.js';
import { waitForEmail } from '../support/mailpit.js';

// The quote form and the answer screen run in quotes.spec.ts; this file checks the emails of each step.
test.describe('RF-33 solicitar orçamento: emails ao cliente e à gerência', { tag: '@RF-33' }, () => {
  test('o pedido de orçamento e a resposta chegam por email', async ({ request }, testInfo) => {
    const manager = await signInApi(request, MANAGER);
    const customer = await newCustomer(request, testInfo, 'Otávio Orçamento');
    const description = `Geladeira desligando sozinha à noite (${crypto.randomUUID()}).`;
    const id = await requestQuote(request, customer, description);

    const receipt = await waitForEmail(request, customer.email, `Recebemos seu pedido de orçamento nº ${id}`);
    expect(receipt.text).toContain(FRIDGE_REPAIR);
    const notice = await waitForEmail(request, ADMIN, `Novo pedido de orçamento nº ${id}: ${FRIDGE_REPAIR}`);
    expect(notice.text).toContain(description);

    await answerQuote(request, manager, id);
    const answer = await waitForEmail(request, customer.email, `Seu orçamento nº ${id} está pronto`);
    expect(answer.text).toMatch(/R\$\s350,00/);
  });
});
