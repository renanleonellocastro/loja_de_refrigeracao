import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from '../support/a11y.js';
import { open } from '../support/viewport.js';

// Runs against the real API started by `pnpm --filter @rc/api e2e:stack` (development seed).
const PASSWORD = 'Castro-Dev-2026';
const CUSTOMER = 'cliente@castro.dev';
const MANAGER = 'gerente@castro.dev';
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Waits for toasts and dialogs to finish fading in, so contrast is checked on the final colors. */
async function checkA11y(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
  await expectAccessible(page);
}

async function signOut(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
}

async function signIn(page: Page, email: string): Promise<void> {
  await open(page, '/entrar');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
}

test.describe('orçamentos', () => {
  test('cliente pede orçamento, gerente responde com valor e cliente aceita com datas', async ({
    page,
  }, testInfo) => {
    const description = `Instalar split de 12.000 BTUs na sala (${testInfo.project.name} ${Date.now()}).`;

    // Asking for a quote needs an account: guests sign in and come back to the form.
    await open(page, '/orcamento');
    await expect(page).toHaveURL(/\/entrar\?redirect=/);
    await page.getByLabel('Email').fill(CUSTOMER);
    await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/orcamento$/);

    await page.locator('label', { hasText: 'Conserto de geladeira' }).click();
    await expect(page.getByRole('radio', { name: /Conserto de geladeira/ })).toBeChecked();
    await page.getByLabel('Descrição').fill(description);
    await page.locator('input[type="file"][multiple]').setInputFiles({
      name: 'sala.png',
      mimeType: 'image/png',
      buffer: PIXEL,
    });
    await expect(page.getByText('1 de 6 fotos')).toBeVisible();
    await checkA11y(page);
    const created = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().endsWith('/api/v1/quotes'),
    );
    const photos = page.waitForResponse((response) => /\/quotes\/\d+\/photos$/.test(response.url()));
    await page.getByRole('button', { name: 'Pedir orçamento' }).click();
    expect((await created).headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    expect((await photos).status()).toBe(201);
    await expect(page.getByRole('heading', { name: 'Pronto! Pedido de orçamento enviado.' })).toBeVisible();
    const id = (await page.getByTestId('quote-number').textContent())!.trim();
    await checkA11y(page);

    await open(page, '/minha-conta/orcamentos');
    await expect(page.getByRole('link', { name: new RegExp(`Orçamento ${id}\\b`) })).toBeVisible();
    await checkA11y(page);

    // The manager finds the quote in the queue and answers it with a value.
    await signOut(page);
    await signIn(page, MANAGER);
    await open(page, '/orcamentos');
    await page.getByLabel('Buscar orçamentos').fill(id);
    await expect(page.getByRole('link', { name: `Orçamento ${id}` }).first()).toBeVisible();
    await checkA11y(page);
    await open(page, `/orcamentos/${id}`);
    await expect(page.getByTestId('quote-description')).toHaveText(description);
    await expect(page.getByRole('img', { name: /Foto 1 do pedido/ })).toBeVisible();
    await page.getByLabel('Valor').fill('123456');
    await expect(page.getByLabel('Valor')).toHaveValue('R$ 1.234,56');
    await page.getByLabel('Validade em dias').fill('15');
    await page.getByLabel('O que está incluído').fill('Mão de obra, suporte e 2 metros de tubulação.');
    await page.getByLabel('Observações').fill('Pagamento na hora do serviço.');
    await checkA11y(page);
    await page.getByRole('button', { name: 'Enviar orçamento' }).click();
    await expect(page.locator('[data-status="ANSWERED"]')).toBeVisible();
    await expect(page.getByTestId('quote-amount')).toHaveText('R$ 1.234,56');
    await checkA11y(page);

    // The customer accepts with the days that suit and gets a visit request.
    await signOut(page);
    await signIn(page, CUSTOMER);
    await open(page, `/minha-conta/orcamentos/${id}`);
    await expect(page.getByTestId('quote-amount')).toHaveText('R$ 1.234,56');
    await expect(page.getByText('Mão de obra, suporte e 2 metros de tubulação.')).toBeVisible();
    await checkA11y(page);
    await page.getByRole('button', { name: 'Aceitar', exact: true }).click();
    await page.getByLabel('Período').selectOption('AFTERNOON');
    await page.getByRole('button', { name: 'Adicionar data' }).click();
    await expect(page.getByRole('list', { name: 'Datas escolhidas' }).getByRole('listitem')).toHaveCount(1);
    const other = page.getByRole('radio', { name: 'Outro endereço' });
    await expect(other.or(page.getByText('Seu cadastro não tem endereço.'))).toBeVisible();
    if (await other.isVisible()) await other.check();
    await page.getByLabel('CEP').fill('13800061');
    await expect(page.getByText(/Achamos!|Não achamos esse CEP/)).toBeVisible();
    await page.getByLabel('Rua').fill('Rua Doutor Ulhoa Cintra');
    await page.getByLabel('Número').fill('91');
    await page.getByLabel('Bairro').fill('Centro');
    await page.getByLabel('Cidade').fill('Mogi Mirim');
    await page.getByLabel('UF').selectOption('SP');
    await checkA11y(page);
    await page.getByRole('button', { name: 'Aceitar e pedir visita' }).click();
    await expect(page.locator('[data-status="ACCEPTED"]')).toBeVisible();
    const visit = page.getByRole('link', { name: 'Ver agendamento' });
    await expect(visit).toHaveAttribute('href', /^\/minha-conta\/agendamentos\/\d+$/);
    await checkA11y(page);
    await visit.click();
    await expect(page).toHaveURL(/\/minha-conta\/agendamentos\/\d+$/);
    await expect(page.locator('[data-status="REQUESTED"]')).toBeVisible();
    await checkA11y(page);
  });
});
