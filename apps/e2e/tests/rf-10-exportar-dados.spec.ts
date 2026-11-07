import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { expectAccessibleSettled } from '../support/a11y.js';
import { newCustomer } from '../support/api.js';
import { signIn } from '../support/session.js';
import { closeToast } from '../support/toast.js';
import { open } from '../support/viewport.js';

// The privacy acceptance at sign up and the account deletion run in account.spec.ts.
test.describe('RF-10 LGPD exportar meus dados', { tag: '@RF-10' }, () => {
  test('o cliente baixa um arquivo JSON com os próprios dados', async ({ page, request }, testInfo) => {
    const customer = await newCustomer(request, testInfo, 'Lara Exporta');
    await signIn(page, customer.email);
    await open(page, '/perfil?aba=privacidade');
    await expect(page.getByRole('button', { name: 'Excluir minha conta' })).toBeVisible();
    await expectAccessibleSettled(page);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Baixar meus dados' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('meus-dados-refrigeracao-castro.json');
    await closeToast(page, 'Pronto! Baixamos o arquivo com os seus dados.');
    const content = await readFile((await file.path())!, 'utf8');
    expect(content).toContain(customer.email);
    expect(content).toContain('Lara Exporta');
  });
});
