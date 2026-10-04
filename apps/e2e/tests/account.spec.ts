import { expect, test, type Page } from '@playwright/test';
import { open } from '../support/viewport.js';

// Runs against the real API started by `pnpm --filter @rc/api e2e:stack` (development seed).
const PASSWORD = 'Castro-Dev-2026';

async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Menu da conta' }).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await expect(page.getByText('Você saiu da sua conta. Até logo!')).toBeVisible();
}

test.describe('RF-01 e RF-04 conta', () => {
  test('entra, volta para a página pedida e sai', async ({ page }) => {
    await open(page, '/perfil');
    await expect(page).toHaveURL(/\/entrar\?redirect=(%2F|\/)perfil/);
    await page.getByLabel('Email').fill('cliente@castro.dev');
    await page.locator('input[autocomplete="current-password"]').fill('senha-errada');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/perfil$/);
    await expect(page.getByRole('heading', { name: 'Seus dados' })).toBeVisible();
    await signOut(page);
    await open(page, '/perfil');
    await expect(page).toHaveURL(/\/entrar/);
  });

  test('cria a conta, entra e exclui a conta', async ({ page }, testInfo) => {
    await open(page, '/criar-conta');
    await page.getByLabel('Nome completo').fill('Teste Automatizado');
    await page.getByLabel('Email').fill(`e2e.${testInfo.project.name}.${Date.now()}@exemplo.com`);
    await page.getByLabel('Telefone').fill('19999998888');
    await page.locator('input[autocomplete="new-password"]').nth(0).fill('Senha-Forte-2026');
    await page.locator('input[autocomplete="new-password"]').nth(1).fill('Senha-Forte-2026');
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Criar minha conta' }).click();
    await expect(page.getByText('Pronto, Teste! Sua conta está criada.')).toBeVisible();
    await open(page, '/perfil?aba=privacidade');
    await page.getByRole('button', { name: 'Excluir minha conta' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input').fill('Senha-Forte-2026');
    await dialog.getByRole('button', { name: 'Excluir minha conta' }).click();
    await expect(page.getByText('Sua conta foi excluída.')).toBeVisible();
  });
});
