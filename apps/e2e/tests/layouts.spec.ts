import { expect, test } from '@playwright/test';
import { expectAccessible } from '../support/a11y.js';
import { deviceOf, hasHorizontalScroll, open } from '../support/viewport.js';

test.describe('RNF-01 e RNF-02 layout público', () => {
  test('cabeçalho e rodapé com os dados da loja, sem rolagem horizontal @a11y', async ({
    page,
  }, testInfo) => {
    await open(page, '/');
    await expect(page.getByRole('banner').getByRole('link', { name: /página inicial/ })).toBeVisible();
    const footer = page.getByRole('contentinfo');
    await expect(footer).toContainText('Rua Doutor Ulhoa Cintra, 91');
    await expect(footer).toContainText('(19) 3804-1658');
    // The development seed has no WhatsApp number, so the floating button stays hidden.
    await expect(page.getByRole('link', { name: /WhatsApp/ })).toHaveCount(0);
    const mainNav = page.getByRole('navigation', { name: 'Principal' });
    if (deviceOf(testInfo) === 'desktop') {
      await expect(mainNav).toBeVisible();
      await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeHidden();
    } else {
      await expect(mainNav).toBeHidden();
      await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeVisible();
    }
    expect(await hasHorizontalScroll(page)).toBe(false);
    await expectAccessible(page);
  });

  test('gaveta abre e fecha pelo teclado', async ({ page }, testInfo) => {
    test.skip(deviceOf(testInfo) === 'desktop', 'O desktop mostra o menu completo.');
    await open(page, '/');
    const toggle = page.getByRole('button', { name: 'Abrir menu' });
    await toggle.focus();
    await page.keyboard.press('Enter');
    const drawer = page.getByRole('dialog', { name: 'Menu' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('link', { name: 'Produtos' })).toBeVisible();
    await expectAccessible(page);
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test('sem rolagem horizontal a partir de 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const path of ['/', '/design', '/design/area?papel=ADMIN', '/pagina-que-nao-existe']) {
      await open(page, path);
      expect(await hasHorizontalScroll(page), path).toBe(false);
    }
  });
});

test.describe('RNF-02 layout da área logada', () => {
  test('navegação certa para cada dispositivo @a11y', async ({ page }, testInfo) => {
    await open(page, '/design/area?papel=MANAGER');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Prévia da área');
    const side = page.getByTestId('side-nav');
    const bottom = page.getByTestId('bottom-nav');
    const device = deviceOf(testInfo);
    if (device === 'celular') {
      await expect(bottom).toBeVisible();
      await expect(side).toBeHidden();
      await expect(bottom.getByRole('link')).toHaveCount(4);
      await expect(bottom.getByRole('button', { name: 'Mais' })).toBeVisible();
    } else {
      await expect(bottom).toBeHidden();
      await expect(side).toBeVisible();
      const width = (await side.boundingBox())!.width;
      // Icon rail on tablets, sidebar with labels on desktops.
      if (device === 'tablet') expect(width).toBeLessThan(120);
      else expect(width).toBeGreaterThan(200);
      await expect(side.getByText('Operação')).toBeVisible({ visible: device === 'desktop' });
    }
    expect(await hasHorizontalScroll(page)).toBe(false);
    await expectAccessible(page);
  });

  test('itens do menu seguem o papel', async ({ page }, testInfo) => {
    test.skip(deviceOf(testInfo) !== 'desktop', 'A lista completa aparece na barra lateral.');
    await open(page, '/design/area?papel=EMPLOYEE');
    const side = page.getByTestId('side-nav');
    await expect(side.getByRole('link', { name: 'Hoje' })).toBeVisible();
    await expect(side.getByRole('link', { name: 'Painel' })).toHaveCount(0);
    await open(page, '/design/area?papel=ADMIN');
    await expect(side.getByRole('link', { name: 'Auditoria' })).toBeVisible();
    await open(page, '/design/area?papel=CLIENT');
    await expect(side.getByRole('link', { name: 'Orçamentos' })).toBeVisible();
    await expect(side.getByRole('link', { name: 'Balcão' })).toHaveCount(0);
  });

  test('menu "Mais" abre e fecha no celular @a11y', async ({ page }, testInfo) => {
    test.skip(deviceOf(testInfo) !== 'celular', 'Só o celular tem a barra inferior.');
    await open(page, '/design/area?papel=ADMIN');
    await page.getByRole('button', { name: 'Mais' }).click();
    const sheet = page.getByRole('dialog', { name: 'Mais opções' });
    await expect(sheet.getByRole('link', { name: 'Auditoria' })).toBeVisible();
    await expectAccessible(page);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });
});
