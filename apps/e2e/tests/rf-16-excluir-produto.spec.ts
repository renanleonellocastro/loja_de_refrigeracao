import { expect, test, type Page } from '@playwright/test';
import { expectAccessibleSettled } from '../support/a11y.js';
import { ADMIN, newCustomer, signInApi } from '../support/api.js';
import { newProduct, placeOrder } from '../support/flows.js';
import { signIn } from '../support/session.js';
import { closeToast } from '../support/toast.js';
import { open } from '../support/viewport.js';

async function removeProduct(page: Page, id: number): Promise<void> {
  await open(page, `/produtos/gerenciar/${id}`);
  await page.getByRole('button', { name: 'Excluir ou arquivar' }).click();
  const dialog = page.getByRole('dialog', { name: 'Excluir este produto?' });
  await expect(dialog).toBeVisible();
  await expectAccessibleSettled(page);
  await dialog.getByRole('button', { name: 'Excluir produto' }).click();
}

test.describe('RF-16 excluir produto', { tag: '@RF-16' }, () => {
  test('o produto nunca vendido some e o vendido fica arquivado', async ({ page, request }, testInfo) => {
    const admin = await signInApi(request, ADMIN);
    const stamp = `${testInfo.project.name} ${crypto.randomUUID().slice(0, 8)}`;
    const unsold = await newProduct(request, admin, `Termostato ${stamp}`);
    const sold = await newProduct(request, admin, `Ventilador ${stamp}`);
    await placeOrder(request, await newCustomer(request, testInfo, 'Diego Compra'), sold.id);

    await signIn(page, ADMIN);
    await removeProduct(page, unsold.id);
    await closeToast(page, 'Produto excluído.');
    await expect(page).toHaveURL(/\/produtos\/gerenciar$/);

    await removeProduct(page, sold.id);
    await closeToast(page, 'Produto arquivado.');
    await expect(page.getByText('Produto arquivado').first()).toBeVisible();
  });
});
