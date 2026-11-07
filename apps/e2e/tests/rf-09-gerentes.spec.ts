import { expect, test } from '@playwright/test';
import { expectAccessibleSettled } from '../support/a11y.js';
import { ADMIN } from '../support/api.js';
import { uniqueCpf, uniqueEmail } from '../support/identity.js';
import { waitForEmail } from '../support/mailpit.js';
import { signIn } from '../support/session.js';
import { closeToast } from '../support/toast.js';
import { open } from '../support/viewport.js';

test.describe('RF-09 cadastrar, consultar e excluir gerentes', { tag: '@RF-09' }, () => {
  test('o super usuário cadastra um gerente, abre o cadastro e o exclui', async ({
    page,
    request,
  }, testInfo) => {
    const name = `Gerente ${testInfo.project.name} ${crypto.randomUUID().slice(0, 8)}`;
    const email = uniqueEmail('gerente', testInfo);
    await signIn(page, ADMIN);
    await open(page, '/gerentes');
    await page.getByRole('button', { name: 'Cadastrar gerente' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nome completo').fill(name);
    await dialog.getByLabel('Email').fill(email);
    await dialog.getByLabel('CPF').fill(uniqueCpf());
    await dialog.getByRole('button', { name: 'Cadastrar e enviar convite' }).click();
    await closeToast(page, /foi cadastrado\./);
    await waitForEmail(request, email, 'Seu acesso à Refrigeração Castro');

    await page.getByLabel('Buscar gerentes').fill(name);
    await page.getByRole('link', { name }).first().click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await expect(page.getByText('Convite pendente')).toBeVisible();
    await expectAccessibleSettled(page);

    await page.getByRole('button', { name: 'Excluir gerente' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Excluir gerente' }).click();
    await closeToast(page, 'Gerente foi excluído.');
    await expect(page).toHaveURL(/\/gerentes$/);
    await page.getByLabel('Buscar gerentes').fill(name);
    await expect(page.getByRole('link', { name })).toHaveCount(0);
  });
});
