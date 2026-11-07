import { expect, test } from '@playwright/test';
import { expectAccessibleSettled } from '../support/a11y.js';
import { newCustomer, PASSWORD } from '../support/api.js';
import { waitForEmail } from '../support/mailpit.js';
import { signIn, signOut } from '../support/session.js';
import { closeToast } from '../support/toast.js';
import { open } from '../support/viewport.js';

const NEW_PASSWORD = 'Outra-Senha-2026';

test.describe('RF-03 alterar a própria senha', { tag: '@RF-03' }, () => {
  test('o cliente troca a senha informando a atual e recebe o aviso por email', async ({
    page,
    request,
  }, testInfo) => {
    const customer = await newCustomer(request, testInfo, 'Tiago Troca');
    await signIn(page, customer.email);
    await open(page, '/perfil?aba=seguranca');
    await page.getByRole('textbox', { name: 'Senha atual' }).fill('Senha-Errada-2026');
    await page.getByRole('textbox', { name: 'Nova senha', exact: true }).fill(NEW_PASSWORD);
    await page.getByRole('textbox', { name: 'Confirme a nova senha' }).fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Alterar senha' }).click();
    await expect(page.getByText(/senha atual/i).last()).toBeVisible();
    await page.getByRole('textbox', { name: 'Senha atual' }).fill(PASSWORD);
    await expectAccessibleSettled(page);
    await page.getByRole('button', { name: 'Alterar senha' }).click();
    await closeToast(page, 'Senha alterada!');

    const email = await waitForEmail(request, customer.email, 'Sua senha foi alterada');
    expect(email.text).toContain('Olá, Tiago!');
    await signOut(page);
    await signIn(page, customer.email, NEW_PASSWORD);
  });
});
