import { expect, test } from '@playwright/test';
import { expectAccessibleSettled } from '../support/a11y.js';
import { newCustomer } from '../support/api.js';
import { linkPath, waitForEmail } from '../support/mailpit.js';
import { signIn, signOut } from '../support/session.js';
import { open } from '../support/viewport.js';

const NEW_PASSWORD = 'Nova-Senha-2026';

test.describe('RF-02 recuperar senha', { tag: '@RF-02' }, () => {
  test('o cliente pede o link, cria a senha nova pelo email e o link não vale de novo', async ({
    page,
    request,
  }, testInfo) => {
    const customer = await newCustomer(request, testInfo, 'Rita Recupera');

    await open(page, '/esqueci-minha-senha');
    await page.getByLabel('Email').fill(customer.email);
    await page.getByRole('button', { name: 'Enviar link' }).click();
    await expect(page.getByRole('heading', { name: 'Confira seu email' })).toBeVisible();
    await expectAccessibleSettled(page);

    const email = await waitForEmail(request, customer.email, 'Redefinição de senha');
    expect(email.text).toContain('Olá, Rita!');
    expect(email.text).toContain('O link vale por 30 minutos e só pode ser usado uma vez.');
    const link = linkPath(email, '/redefinir-senha/');

    await open(page, link);
    await page.getByRole('textbox', { name: 'Nova senha', exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel('Confirme a nova senha').fill(NEW_PASSWORD);
    await expectAccessibleSettled(page);
    await page.getByRole('button', { name: 'Salvar nova senha' }).click();
    await expect(page.getByText('Senha nova salva! Você já está dentro.')).toBeVisible();

    // Single use: the same link now explains it is no longer valid.
    await signOut(page);
    await open(page, link);
    await page.getByRole('textbox', { name: 'Nova senha', exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel('Confirme a nova senha').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Salvar nova senha' }).click();
    await expect(page.getByRole('heading', { name: 'Este link não vale mais' })).toBeVisible();

    await signIn(page, customer.email, NEW_PASSWORD);
  });
});
