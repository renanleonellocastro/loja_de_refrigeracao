import { expect, test } from '@playwright/test';
import { expectAccessibleSettled } from '../support/a11y.js';
import { ADMIN, newCustomer } from '../support/api.js';
import { FRIDGE_REPAIR, requestService } from '../support/flows.js';
import { uniqueEmail } from '../support/identity.js';
import { waitForEmail } from '../support/mailpit.js';
import { signIn } from '../support/session.js';
import { closeToast } from '../support/toast.js';
import { deviceOf, open } from '../support/viewport.js';

const NOTICE_EMAILS = 'Emails que recebem os avisos da equipe';

test.describe('RF-39 configurações da loja', { tag: '@RF-39' }, () => {
  test('o super usuário inclui um email nos avisos da equipe e ele passa a receber', async ({
    page,
    request,
  }, testInfo) => {
    // The store has one set of settings: a single device changes it, so devices never overwrite each other.
    test.skip(deviceOf(testInfo) !== 'desktop', 'as configurações são uma só para todos os aparelhos');
    const extra = uniqueEmail('avisos', testInfo);
    await signIn(page, ADMIN);
    await open(page, '/configuracoes');
    const field = page.getByLabel(NOTICE_EMAILS);
    const original = await field.inputValue();
    await field.fill([original, extra].filter(Boolean).join('\n'));
    await expectAccessibleSettled(page);
    await page.getByRole('button', { name: 'Salvar configurações' }).click();
    await closeToast(page, 'Pronto! As configurações da loja foram salvas.');

    try {
      const customer = await newCustomer(request, testInfo, 'Nina Nova');
      const id = await requestService(request, customer, `Bebedouro sem gelar (${crypto.randomUUID()}).`);
      await waitForEmail(request, extra, `Nova solicitação nº ${id}: ${FRIDGE_REPAIR}`);
    } finally {
      await field.fill(original);
      await page.getByRole('button', { name: 'Salvar configurações' }).click();
      await closeToast(page, 'Pronto! As configurações da loja foram salvas.');
    }
    await page.reload();
    await expect(page.getByLabel(NOTICE_EMAILS)).toHaveValue(original);
  });
});
