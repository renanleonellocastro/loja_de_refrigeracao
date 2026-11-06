import { expect, test } from '@playwright/test';
import { expectAccessibleSettled } from '../support/a11y.js';
import { MANAGER, newCustomer, signInApi } from '../support/api.js';
import { answerQuote, requestQuote } from '../support/flows.js';
import { signIn } from '../support/session.js';
import { closeToast } from '../support/toast.js';
import { open } from '../support/viewport.js';

test.describe('RF-40 central de notificações', { tag: '@RF-40' }, () => {
  test('o cliente vê as não lidas, abre uma e marca todas como lidas', async ({ page, request }, testInfo) => {
    const manager = await signInApi(request, MANAGER);
    const customer = await newCustomer(request, testInfo, 'Nara Notificada');
    const id = await requestQuote(request, customer, `Freezer horizontal sem gelar (${crypto.randomUUID()}).`);
    await answerQuote(request, manager, id);

    await signIn(page, customer.email);
    await open(page, '/notificacoes');
    await expect(page.getByText(/\d+ não lidas?\./)).toBeVisible();
    await expectAccessibleSettled(page);
    await page.getByRole('button', { name: new RegExp(`Seu orçamento nº ${id} está pronto`) }).click();
    await expect(page).toHaveURL(new RegExp(`/minha-conta/orcamentos/${id}$`));

    await open(page, '/notificacoes');
    await page.getByRole('button', { name: 'Marcar todas como lidas' }).click();
    await closeToast(page, 'Pronto! Tudo marcado como lido.');
    await expect(page.getByText('Nenhuma notificação nova.')).toBeVisible();
  });
});
