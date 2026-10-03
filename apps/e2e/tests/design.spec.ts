import { expect, test } from '@playwright/test';
import { expectAccessible } from '../support/a11y.js';
import { hasHorizontalScroll, open } from '../support/viewport.js';

test.describe('RNF-05 e RNF-06 guia vivo de componentes', () => {
  test('não é indexado e não rola na horizontal', async ({ page }) => {
    await open(page, '/design');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Design system');
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passa no axe no tema ${scheme === 'light' ? 'claro' : 'escuro'} @a11y`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await open(page, '/design');
      await expectAccessible(page);
    });
  }

  test('toast com desfazer e confirmação de exclusão @a11y', async ({ page }) => {
    await open(page, '/design');
    await page.getByRole('button', { name: 'Salvar com desfazer' }).click();
    const toast = page.getByRole('status').filter({ hasText: 'Pronto! Alterações salvas.' });
    await expect(toast).toBeVisible();
    await toast.getByRole('button', { name: 'Desfazer' }).click();
    await expect(page.getByText('Alteração desfeita.')).toBeVisible();

    await page.getByRole('button', { name: 'Excluir produto' }).click();
    const confirm = page.getByRole('dialog', { name: 'Excluir este produto?' });
    await expect(confirm).toBeVisible();
    await expectAccessible(page);
    await confirm.getByRole('button', { name: 'Excluir produto' }).click();
    await expect(page.getByText('Produto excluído.')).toBeVisible();
  });

  test('máscaras brasileiras formatam enquanto digita', async ({ page }) => {
    await open(page, '/design');
    const cnpj = page.getByLabel('CNPJ');
    await cnpj.fill('');
    await cnpj.pressSequentially('63060560000151');
    await expect(cnpj).toHaveValue('63.060.560/0001-51');
    const price = page.getByLabel('Preço');
    await price.fill('');
    await price.pressSequentially('4599');
    await expect(price).toHaveValue('R$ 45,99');
  });
});

test.describe('RNF-05 tema claro, escuro e automático', () => {
  test('a escolha vale na hora e continua depois de recarregar', async ({ page }) => {
    await open(page, '/design');
    const toggle = page.getByRole('group', { name: 'Tema' }).first();
    await toggle.getByText('Escuro').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(
      page.getByRole('group', { name: 'Tema' }).first().getByRole('radio', { name: 'Escuro' }),
    ).toBeChecked();
    await page.getByRole('group', { name: 'Tema' }).first().getByText('Automático').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === 'true');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  });
});

test.describe('Páginas de erro', () => {
  test('404 com a marca e caminho de volta', async ({ page }) => {
    const response = await page.goto('/pagina-que-nao-existe');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Procuramos em todas as prateleiras');
    await expect(page.getByRole('main').getByRole('link', { name: 'Voltar ao início' })).toBeVisible();
  });
});
