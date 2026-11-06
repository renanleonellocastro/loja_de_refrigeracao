import { expect, test } from '@playwright/test';
import { expectAccessibleSettled } from '../support/a11y.js';
import { newCustomer } from '../support/api.js';
import { signIn } from '../support/session.js';
import { closeToast } from '../support/toast.js';
import { open } from '../support/viewport.js';

// The CEP service is outside the store; the test answers for it so the run never depends on it.
const FOUND = {
  cep: '13800061',
  street: 'Rua Doutor Ulhôa Cintra',
  district: 'Centro',
  city: 'Mogi Mirim',
  state: 'SP',
};

// The latest orders, services and quotes on the profile run in account.spec.ts.
test.describe('RF-06 ver e editar o próprio perfil', { tag: '@RF-06' }, () => {
  test('o cliente muda o nome e preenche o endereço pelo CEP', async ({ page, request }, testInfo) => {
    const customer = await newCustomer(request, testInfo, 'Pedro Perfil');
    await page.route('**/api/v1/addresses/lookup?**', (route) => route.fulfill({ json: FOUND }));
    await signIn(page, customer.email);

    await open(page, '/perfil');
    await page.getByRole('textbox', { name: 'Nome completo' }).fill('Pedro Perfil Atualizado');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await closeToast(page, 'Pronto! Seus dados foram atualizados.');

    await open(page, '/perfil?aba=endereco');
    await page.getByRole('textbox', { name: 'CEP' }).fill('13800061');
    await expect(page.getByRole('textbox', { name: 'Rua' })).toHaveValue(FOUND.street);
    await expect(page.getByRole('textbox', { name: 'Cidade' })).toHaveValue(FOUND.city);
    await page.getByRole('textbox', { name: 'Número' }).fill('91');
    await expectAccessibleSettled(page);
    await page.getByRole('button', { name: 'Salvar endereço' }).click();
    await closeToast(page, 'Pronto! Endereço salvo.');

    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Número' })).toHaveValue('91');
    await open(page, '/perfil');
    await expect(page.getByRole('textbox', { name: 'Nome completo' })).toHaveValue('Pedro Perfil Atualizado');
  });
});
