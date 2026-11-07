import { expect, test } from '@playwright/test';
import { expectAccessibleSettled } from '../support/a11y.js';
import { ADMIN, newCustomer } from '../support/api.js';
import { signIn } from '../support/session.js';
import { closeToast } from '../support/toast.js';
import { open } from '../support/viewport.js';

test.describe('RF-07 excluir cliente', { tag: '@RF-07' }, () => {
  test('o super usuário exclui um cliente depois de confirmar no modal', async ({
    page,
    request,
  }, testInfo) => {
    const name = `Edu Excluído ${testInfo.project.name} ${crypto.randomUUID().slice(0, 8)}`;
    const customer = await newCustomer(request, testInfo, name);
    await signIn(page, ADMIN);
    await open(page, `/clientes/${customer.id}`);
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await page.getByRole('button', { name: 'Excluir cliente' }).click();
    const dialog = page.getByRole('dialog', { name: 'Excluir este cliente?' });
    await expect(dialog).toBeVisible();
    await expectAccessibleSettled(page);
    await dialog.getByRole('button', { name: 'Excluir cliente' }).click();
    await closeToast(page, 'Edu foi excluído.');
    await expect(page).toHaveURL(/\/clientes$/);

    // The record stays for the orders, without the personal data, so the search no longer finds the name.
    await page.getByLabel('Buscar clientes').fill(name);
    await expect(page.getByRole('link', { name })).toHaveCount(0);
  });
});
