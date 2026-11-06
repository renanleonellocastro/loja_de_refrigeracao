import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectAccessibleSettled } from '../support/a11y.js';
import { uniqueEmail } from '../support/identity.js';
import { closeToast, closeWelcomeToast } from '../support/toast.js';
import { deviceOf, hasHorizontalScroll, open } from '../support/viewport.js';

// Runs against the real API started by `pnpm --filter @rc/api e2e:stack` (development seed).
const PASSWORD = 'Castro-Dev-2026';

/** A tiny valid PNG (1 x 1 pixel), enough for the photo pipeline of the API. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

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
  await closeWelcomeToast(page);
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

/** On the phone the product form shows one step at a time; wider screens show every field at once. */
async function nextStepOnPhone(page: Page, testInfo: TestInfo): Promise<void> {
  if (deviceOf(testInfo) !== 'celular') return;
  await page.getByRole('button', { name: 'Continuar' }).click();
}

async function openStepOnPhone(page: Page, testInfo: TestInfo, step: string): Promise<void> {
  if (deviceOf(testInfo) !== 'celular') return;
  await page
    .getByRole('navigation', { name: 'Etapas do formulário' })
    .getByRole('button', { name: step })
    .click();
}

/** Fills the open new product form, step by step on the phone, saves it and lands on its photos. */
async function createProduct(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await page.getByLabel('Nome do produto').fill(name);
  await page.getByLabel('Categoria').selectOption({ label: 'Peças e acessórios' });
  await page.getByLabel('Marca').fill('Danfoss');
  await nextStepOnPhone(page, testInfo);
  await page.getByLabel('Preço').fill('89,90');
  await page.getByLabel('Estoque inicial').fill('5');
  await nextStepOnPhone(page, testInfo);
  await page.getByLabel('Descrição').fill('Filtro secador para linha de refrigeração.');
  await expectAccessibleSettled(page);
  await page.getByRole('button', { name: 'Cadastrar produto' }).click();
  await expect(page).toHaveURL(/\/produtos\/gerenciar\/\d+\?aba=fotos$/);
  await closeToast(page, 'Produto cadastrado.');
}

test.describe('RF-12 a RF-16, RF-25 e RF-26 produtos, pedidos e balcão', () => {
  test('o gerente cadastra um produto, o cliente compra, a loja entrega e o técnico vende no balcão', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const stamp = `${testInfo.project.name} ${Date.now()}`;
    const productName = `Filtro secador ${stamp}`;
    const customerName = `Cliente Balcão ${Date.now()}`;
    const customerEmail = uniqueEmail('balcao', testInfo);
    await createCustomer(page, customerName, customerEmail);

    // The manager registers the product with its initial stock.
    await signIn(page, 'gerente@castro.dev', /\/painel/);
    await open(page, '/produtos/gerenciar');
    await page.getByLabel('Buscar produtos').fill('compresor');
    await expect(page.getByRole('link', { name: 'Compressor Embraco 1/4 HP' })).toBeVisible();
    await expectAccessibleSettled(page);
    await page.getByRole('link', { name: 'Cadastrar produto' }).first().click();
    await expect(page).toHaveURL(/\/produtos\/gerenciar\/novo$/);
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === 'true');
    await createProduct(page, testInfo, productName);
    await expect(page.getByRole('heading', { level: 2, name: productName })).toBeVisible();

    // Photos: upload with progress, then it becomes the cover.
    await page.locator('input[type="file"][multiple]').setInputFiles({
      name: 'filtro.png',
      mimeType: 'image/png',
      buffer: PIXEL,
    });
    await expect(page.getByText('1 de 10 fotos')).toBeVisible();
    await page.getByRole('button', { name: 'Enviar fotos' }).click();
    await closeToast(page, 'Foto enviada.');
    await expect(page.getByRole('list', { name: 'Fotos do produto' }).getByText('Capa')).toBeVisible();
    await expectAccessibleSettled(page);

    // Stock: an entry of 3 units.
    await page.getByRole('tab', { name: 'Estoque' }).click();
    await expect(page.getByText('Entrada', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Movimentar estoque' }).click();
    const stockDialog = page.getByRole('dialog');
    await stockDialog.getByLabel('Quantidade').fill('3');
    await stockDialog.getByLabel('Motivo').fill('Nota fiscal 123');
    await stockDialog.getByRole('button', { name: 'Salvar movimentação' }).click();
    await closeToast(page, 'Estoque atualizado: 8 disponíveis.');
    await expectAccessibleSettled(page);
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
    await expectAccessibleSettled(page);
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
    expect(await hasHorizontalScroll(page)).toBe(false);
    await expectAccessibleSettled(page);
    const sold = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().endsWith('/api/v1/counter-sales'),
    );
    await page.getByRole('button', { name: 'Confirmar venda' }).click();
    expect((await sold).headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: 'Venda registrada!' })).toBeVisible();
    await expectAccessibleSettled(page);
  });

  test('o gerente fecha um pedido online em nome de um cliente e ele entra na fila', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const productName = 'Ar Condicionado Split Inverter Springer Midea 12000 BTUs';
    const customerName = `Cliente Telefone ${Date.now()}`;
    const customerEmail = uniqueEmail('telefone', testInfo);
    await createCustomer(page, customerName, customerEmail);
    await signIn(page, 'gerente@castro.dev', /\/painel/);
    await open(page, '/pedidos');
    await page.getByRole('link', { name: 'Novo pedido' }).click();
    await expect(page).toHaveURL(/\/pedidos\/novo$/);
    await page.getByLabel('Buscar produto').fill('Midea');
    await page.getByRole('button', { name: `Adicionar ${productName}` }).click();
    await page.getByLabel('Cliente', { exact: true }).fill(customerEmail);
    await page.getByRole('button', { name: new RegExp(customerName) }).click();
    await expect(page.getByTestId('picked-customer')).toHaveText(customerName);
    await expect(page.getByText('Retirada na loja.')).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    await expectAccessibleSettled(page);
    const placed = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().endsWith('/api/v1/orders'),
    );
    await page.getByRole('button', { name: 'Fechar pedido' }).click();
    expect((await placed).headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: 'Pedido fechado!' })).toBeVisible();
    const number = (await page.getByTestId('sale-number').textContent())!;
    await expectAccessibleSettled(page);

    // The order waits for review like any online order; canceling gives the reserved unit back to the stock.
    await page.getByRole('link', { name: 'Ver pedido' }).click();
    await expect(page.getByRole('heading', { name: `Pedido ${number}` })).toBeVisible();
    await expect(page.locator('[data-status="PENDING_REVIEW"]').first()).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar pedido' }).click();
    await closeToast(page, 'Pedido cancelado. Os itens voltaram para o estoque.');
  });

  test('o gerente vê as diferenças quando outra pessoa salvou o produto antes e mantém as duas edições', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const productName = `Filtro conflito ${testInfo.project.name} ${Date.now()}`;
    await signIn(page, 'gerente@castro.dev', /\/painel/);
    await open(page, '/produtos/gerenciar/novo');
    await createProduct(page, testInfo, productName);
    const editPath = new URL(page.url()).pathname;

    // Someone else, in another tab, changes the price while this tab still shows the old version.
    await page.getByRole('tab', { name: 'Dados' }).click();
    const other = await page.context().newPage();
    await open(other, editPath);
    await openStepOnPhone(other, testInfo, 'Preço e estoque');
    await other.getByLabel('Preço').fill('99,90');
    await other.getByRole('button', { name: 'Salvar alterações' }).click();
    await closeToast(other, 'Alterações salvas.');
    await other.close();

    await page.getByLabel('Modelo').fill('DML 032');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText('Outra pessoa alterou este produto')).toBeVisible();
    const differences = page.getByRole('list', { name: 'Diferenças entre as versões' });
    await expect(differences.getByRole('listitem')).toHaveCount(2);
    await expect(differences.getByText('R$ 99,90')).toBeVisible();
    await expect(differences.getByText('DML 032')).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    await expectAccessibleSettled(page);

    await page.getByRole('button', { name: 'Manter minhas alterações' }).click();
    await expect(page.getByText('Outra pessoa alterou este produto')).toBeHidden();
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await closeToast(page, 'Alterações salvas.');
    await expect(page.getByLabel('Modelo')).toHaveValue('DML 032');
    await openStepOnPhone(page, testInfo, 'Preço e estoque');
    await expect(page.getByLabel('Preço')).toHaveValue('R$ 99,90');
  });
});
