import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from '../support/a11y.js';
import { open } from '../support/viewport.js';

// Runs against the real API started by `pnpm --filter @rc/api e2e:stack` (development seed).
const PASSWORD = 'Castro-Dev-2026';

/** A tiny valid PNG (1 x 1 pixel), enough for the photo pipeline of the API. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Waits for toasts and sheets to finish fading in, so contrast is checked on the final colors. */
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

async function signIn(page: Page, email: string, landing: RegExp): Promise<void> {
  await open(page, '/entrar');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(landing);
}

async function createCustomer(page: Page, name: string, email: string): Promise<void> {
  await open(page, '/criar-conta');
  await page.getByLabel('Nome completo').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Telefone').fill('19999996666');
  await page.locator('input[autocomplete="new-password"]').nth(0).fill(PASSWORD);
  await page.locator('input[autocomplete="new-password"]').nth(1).fill(PASSWORD);
  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(page.getByText('Sua conta está criada.')).toBeVisible();
  await signOut(page);
}

test.describe('RF-12 a RF-16, RF-25 e RF-26 produtos, pedidos e balcão', () => {
  test('o gerente cadastra um produto, o cliente compra, a loja entrega e o técnico vende no balcão', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const stamp = `${testInfo.project.name} ${Date.now()}`;
    const productName = `Filtro secador ${stamp}`;
    const customerName = `Cliente Balcão ${Date.now()}`;
    const customerEmail = `balcao.${testInfo.project.name}.${Date.now()}@exemplo.com`;
    await createCustomer(page, customerName, customerEmail);

    // The manager registers the product with its initial stock.
    await signIn(page, 'gerente@castro.dev', /\/painel/);
    await open(page, '/produtos/gerenciar');
    await page.getByLabel('Buscar produtos').fill('compresor');
    await expect(page.getByRole('link', { name: 'Compressor Embraco 1/4 HP' })).toBeVisible();
    await checkA11y(page);
    await page.getByRole('link', { name: 'Cadastrar produto' }).first().click();
    await expect(page).toHaveURL(/\/produtos\/gerenciar\/novo$/);
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === 'true');
    await page.getByLabel('Nome do produto').fill(productName);
    await page.getByLabel('Categoria').selectOption({ label: 'Peças e acessórios' });
    await page.getByLabel('Marca').fill('Danfoss');
    await page.getByLabel('Preço').fill('89,90');
    await page.getByLabel('Estoque inicial').fill('5');
    await page.getByLabel('Descrição').fill('Filtro secador para linha de refrigeração.');
    await checkA11y(page);
    await page.getByRole('button', { name: 'Cadastrar produto' }).click();
    await expect(page).toHaveURL(/\/produtos\/gerenciar\/\d+\?aba=fotos$/);
    await expect(page.getByRole('heading', { level: 2, name: productName })).toBeVisible();

    // Photos: upload with progress, then it becomes the cover.
    await page.locator('input[type="file"][multiple]').setInputFiles({
      name: 'filtro.png',
      mimeType: 'image/png',
      buffer: PIXEL,
    });
    await expect(page.getByText('1 de 10 fotos')).toBeVisible();
    await page.getByRole('button', { name: 'Enviar fotos' }).click();
    await expect(page.getByText('Foto enviada.')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Fotos do produto' }).getByText('Capa')).toBeVisible();
    await checkA11y(page);

    // Stock: an entry of 3 units.
    await page.getByRole('tab', { name: 'Estoque' }).click();
    await expect(page.getByText('Entrada', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Movimentar estoque' }).click();
    const stockDialog = page.getByRole('dialog');
    await stockDialog.getByLabel('Quantidade').fill('3');
    await stockDialog.getByLabel('Motivo').fill('Nota fiscal 123');
    await stockDialog.getByRole('button', { name: 'Salvar movimentação' }).click();
    await expect(page.getByText('Estoque atualizado: 8 disponíveis.')).toBeVisible();
    await checkA11y(page);
    // Editing sends If-Match with the version on screen.
    await page.getByRole('tab', { name: 'Dados' }).click();
    await page.getByLabel('Modelo').fill('DML 032');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText('Alterações salvas.')).toBeVisible();
    const slug = (await page.getByRole('link', { name: 'Ver no catálogo' }).getAttribute('href'))!;

    // The customer orders one unit.
    await signOut(page);
    await signIn(page, customerEmail, /\/perfil|\/minha-conta|\/painel|\/$/);
    await open(page, slug);
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click();
    await expect(page.getByText(`${productName} no carrinho.`)).toBeVisible();
    await open(page, '/carrinho/finalizar');
    await page.getByRole('button', { name: 'Confirmar pedido' }).click();
    await expect(page.getByRole('heading', { name: 'Pronto! Recebemos seu pedido.' })).toBeVisible();
    const number = (await page.getByTestId('order-number').textContent())!.trim();

    // The manager finds it in the queue, prints the label and hands it over.
    await signOut(page);
    await signIn(page, 'gerente@castro.dev', /\/painel/);
    await open(page, '/pedidos');
    await expect(page.getByRole('tab', { name: /Em análise/ })).toBeVisible();
    await page.getByLabel('Buscar pedidos').fill(number);
    await page.getByRole('link', { name: `Pedido ${number}` }).click();
    await expect(page.getByRole('heading', { name: `Pedido ${number}` })).toBeVisible();
    await checkA11y(page);
    // The label needs the access token, so the site fetches the PDF and opens it in a new tab.
    const popup = page.waitForEvent('popup');
    const label = page.waitForResponse((response) => response.url().endsWith('/label'));
    await page.getByRole('button', { name: 'Imprimir etiqueta' }).click();
    expect((await label).headers()['content-type']).toBe('application/pdf');
    await (await popup).close();
    await page.getByRole('button', { name: 'Pronto para retirada' }).click();
    await expect(page.getByText('Pedido pronto para retirada.')).toBeVisible();
    await page.getByRole('button', { name: 'Marcar como retirado' }).click();
    await expect(page.getByText('Pedido retirado.', { exact: true })).toBeVisible();
    await expect(page.locator('[data-status="PICKED_UP"]').first()).toBeVisible();

    // The technician sells two units at the counter to the same customer.
    await signOut(page);
    await signIn(page, 'tecnico@castro.dev', /\/hoje/);
    await open(page, '/balcao');
    await page.getByLabel('Buscar produto').fill(productName);
    await page.getByRole('button', { name: `Adicionar ${productName}` }).click();
    await page.getByRole('button', { name: `Adicionar ${productName}` }).click();
    await expect(page.getByTestId('counter-total')).toHaveText('R$ 179,80');
    await expect(page.getByRole('button', { name: 'Cadastrar cliente' })).toHaveCount(0);
    await page.getByLabel('Cliente', { exact: true }).fill(customerEmail);
    await page.getByRole('button', { name: new RegExp(customerName) }).click();
    await expect(page.getByTestId('picked-customer')).toHaveText(customerName);
    await checkA11y(page);
    const sold = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().endsWith('/api/v1/counter-sales'),
    );
    await page.getByRole('button', { name: 'Confirmar venda' }).click();
    expect((await sold).headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: 'Venda registrada!' })).toBeVisible();
    await checkA11y(page);
  });
});
