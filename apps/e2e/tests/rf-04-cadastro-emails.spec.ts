import { expect, test } from '@playwright/test';
import { expectAccessibleSettled } from '../support/a11y.js';
import { API, as, call, MANAGER, newCustomer, signInApi } from '../support/api.js';
import { uniqueEmail } from '../support/identity.js';
import { linkPath, waitForEmail } from '../support/mailpit.js';
import { signIn, signOut } from '../support/session.js';
import { open } from '../support/viewport.js';

const PASSWORD = 'Convite-Aceito-2026';

// The sign up form and the staff dialog run in account.spec.ts and staff-users.spec.ts; this file checks the emails.
test.describe('RF-04 cadastrar cliente: emails de boas vindas e de convite', { tag: '@RF-04' }, () => {
  test('quem se cadastra recebe as boas vindas com os dados do cadastro', async ({ request }, testInfo) => {
    const customer = await newCustomer(request, testInfo, 'Bruna Boas Vindas');
    const email = await waitForEmail(request, customer.email, 'Bem vindo à Refrigeração Castro');
    expect(email.text).toContain('Bruna');
    expect(email.text).toContain(customer.email);
  });

  test('o cliente cadastrado pela equipe cria a senha pelo link do convite', async ({
    page,
    request,
  }, testInfo) => {
    const manager = await signInApi(request, MANAGER);
    const address = uniqueEmail('convite', testInfo);
    const data = { role: 'CLIENT', name: 'Caio Convidado', email: address, phone: '19999996666' };
    await call(request.post(`${API}/api/v1/users`, { headers: as(manager, true), data }));

    const email = await waitForEmail(request, address, 'Seu acesso à Refrigeração Castro');
    expect(email.text).toContain('Olá, Caio!');
    await open(page, linkPath(email, '/definir-senha/'));
    await page.getByRole('textbox', { name: 'Nova senha', exact: true }).fill(PASSWORD);
    await page.getByRole('textbox', { name: 'Confirme a nova senha' }).fill(PASSWORD);
    await expectAccessibleSettled(page);
    await page.getByRole('button', { name: 'Criar senha e entrar' }).click();
    await expect(page.getByText('Senha criada! Sua conta está pronta.')).toBeVisible();
    await signOut(page);
    await signIn(page, address, PASSWORD);
  });
});
