import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from '../support/a11y.js';
import { hasHorizontalScroll, open } from '../support/viewport.js';

// Runs against the real API started by `pnpm --filter @rc/api e2e:stack` (development seed).
const PASSWORD = 'Castro-Dev-2026';

async function signIn(page: Page, email: string, landing: RegExp): Promise<void> {
  await open(page, '/entrar');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(landing);
}

test.describe('RF-38 painel da equipe', () => {
  test('gerente vê os indicadores que levam às listas filtradas @a11y', async ({ page }) => {
    await signIn(page, 'gerente@castro.dev', /\/painel$/);
    const kpis = page.getByTestId('kpi');
    await expect(kpis).toHaveCount(6);
    await expect(page.getByTestId('revenue')).toContainText('Serviços aprovados no mês');
    await expect(page.getByRole('heading', { name: 'Agenda de hoje' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Estoque baixo' })).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    await expectAccessible(page);

    await kpis.filter({ hasText: 'Orçamentos a responder' }).click();
    await expect(page).toHaveURL(/\/orcamentos\?estado=REQUESTED/);
  });

  test('técnico vai direto para o dia dele', async ({ page }) => {
    await signIn(page, 'tecnico@castro.dev', /\/hoje$/);
    await open(page, '/painel');
    await expect(page).toHaveURL(/\/hoje$/);
  });
});
