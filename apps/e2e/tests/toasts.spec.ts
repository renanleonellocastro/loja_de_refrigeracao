import { expect, test, type Locator } from '@playwright/test';
import { open } from '../support/viewport.js';

// Runs against the real API started by `pnpm --filter @rc/api e2e:stack` (development seed).
const PASSWORD = 'Castro-Dev-2026';
const CUSTOMER = 'cliente@castro.dev';

/** True when the two elements share any on screen area. */
async function overlaps(first: Locator, second: Locator): Promise<boolean> {
  const [a, b] = [(await first.boundingBox())!, (await second.boundingBox())!];
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

test.describe('RNF-04 notificação não bloqueia o próximo passo', () => {
  test('a boas vindas não cobre o botão Continuar e o toque chega nele na hora', async ({ page }) => {
    await open(page, '/servicos');
    await page.getByRole('link', { name: 'Agendar visita: Conserto de geladeira' }).click();
    await page.getByLabel('Email').fill(CUSTOMER);
    await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/agendar\?servico=\d+$/);

    const welcome = page.getByRole('region', { name: 'Notificações' }).getByRole('status');
    const proceed = page.getByRole('button', { name: 'Continuar' });
    await expect(welcome).toHaveText(/Que bom te ver/);
    await proceed.scrollIntoViewIfNeeded();
    await expect(proceed).toBeInViewport();
    expect(await overlaps(welcome, proceed)).toBe(false);

    // The toast lasts 5 s; a click that had to wait for it would run past this timeout.
    await proceed.click({ timeout: 1_000 });
    await expect(page.getByTestId('step-title')).toHaveText('Qual é o aparelho?');
    await expect(welcome).toBeVisible();
  });
});
