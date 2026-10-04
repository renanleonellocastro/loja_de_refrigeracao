import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from '../support/a11y.js';
import { open } from '../support/viewport.js';

// Runs against the real API started by `pnpm --filter @rc/api e2e:stack` (development seed).
const PASSWORD = 'Castro-Dev-2026';

/** Each device gets its own customer, so parallel runs never share a cart. */
async function createCustomer(page: Page, email: string): Promise<void> {
  await open(page, '/criar-conta');
  await page.getByLabel('Nome completo').fill('Cliente Compras');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Telefone').fill('19999997777');
  await page.locator('input[autocomplete="new-password"]').nth(0).fill(PASSWORD);
  await page.locator('input[autocomplete="new-password"]').nth(1).fill(PASSWORD);
  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(page.getByText('Pronto, Cliente! Sua conta está criada.')).toBeVisible();
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
}

test.describe('RF-20 a RF-24 compras', () => {
  test('visitante busca, adiciona ao carrinho, entra, fecha o pedido e cancela', async ({
    page,
  }, testInfo) => {
    const email = `compras.${testInfo.project.name}.${Date.now()}@exemplo.com`;
    await createCustomer(page, email);

    // Search tolerates the typo and the catalog is public (D1).
    await open(page, '/produtos');
    await expectAccessible(page);
    await page.getByRole('searchbox', { name: 'Buscar produtos' }).fill('compresor');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(page).toHaveURL(/q=compresor/);
    await page.getByRole('link', { name: 'Compressor Embraco 1/4 HP' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Compressor Embraco 1/4 HP' })).toBeVisible();
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === 'true');
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Aumentar quantidade' }).click();
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click();
    await expect(page.getByText('Compressor Embraco 1/4 HP no carrinho.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Carrinho com 2 itens' })).toBeVisible();

    await open(page, '/carrinho');
    await expect(page.getByRole('heading', { name: 'Resumo' })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole('link', { name: 'Fechar pedido' }).click();

    // Closing the order asks to sign in; the visitor cart joins the account cart.
    await expect(page).toHaveURL(/\/entrar\?redirect=/);
    await page.getByLabel('Email').fill(email);
    await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/carrinho\/finalizar$/);
    await expect(page.locator('[data-product="compressor-embraco-1-4-hp"]')).toContainText('2 ×');
    await expectAccessible(page);
    await page.getByLabel('Recado para a loja (opcional)').fill('Retiro na sexta.');
    // The order carries an Idempotency-Key, so a retry after a dropped connection cannot duplicate it.
    const placed = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().endsWith('/api/v1/orders'),
    );
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();
    expect((await placed).headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);

    await expect(page.getByRole('heading', { name: 'Pronto! Recebemos seu pedido.' })).toBeVisible();
    const number = (await page.getByTestId('order-number').textContent())!.trim();
    await expectAccessible(page);

    await open(page, '/minha-conta/pedidos');
    await expect(page.getByRole('link', { name: new RegExp(`Pedido ${number}`) })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole('link', { name: new RegExp(`Pedido ${number}`) }).click();
    await expect(page.getByRole('heading', { name: `Pedido ${number}` })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Cancelar pedido' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Motivo (opcional)').fill('Comprei por engano.');
    await dialog.getByRole('button', { name: 'Cancelar pedido' }).click();
    await expect(page.getByText('Pedido cancelado. Os itens voltaram para a loja.')).toBeVisible();
    await expect(page.locator('[data-status="CANCELED"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelar pedido' })).toHaveCount(0);
  });
});
