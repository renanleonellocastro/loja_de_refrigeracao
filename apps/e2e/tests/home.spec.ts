import { expect, test } from '@playwright/test';
import { expectAccessible } from '../support/a11y.js';
import { hasHorizontalScroll, open } from '../support/viewport.js';

test.describe('RF-36 página inicial', () => {
  test('mostra a marca, serviços e a loja sem rolagem horizontal @a11y', async ({ page }) => {
    await open(page, '/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Refrigeração Castro');
    await expect(page.getByRole('link', { name: 'Agendar visita' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pedir orçamento' }).first()).toBeVisible();
    await expect(page.getByText('Por que a Castro')).toBeVisible();
    await expect(page.getByTestId('open-now')).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
    expect(await hasHorizontalScroll(page)).toBe(false);
    await expectAccessible(page);
  });

  test('traz dados estruturados, canonical e Open Graph', async ({ page }) => {
    await page.goto('/');
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    const business = jsonLd.map((text) => JSON.parse(text)).find((item) => item['@type'] === 'HVACBusiness');
    expect(business).toMatchObject({
      name: 'Refrigeração Castro',
      address: { addressLocality: 'Mogi Mirim' },
    });
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/$/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og-image\.png$/);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  });

  test('sitemap e robots', async ({ request }) => {
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.ok()).toBe(true);
    expect(await sitemap.text()).toContain('/sobre</loc>');
    const robots = await request.get('/robots.txt');
    expect(await robots.text()).toContain('Disallow: /painel');
  });
});

test.describe('RF-37 páginas institucionais', () => {
  test('sobre e contato @a11y', async ({ page }) => {
    await open(page, '/sobre');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sobre a loja');
    await expect(page.getByText('três irmãos Castro')).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    await expectAccessible(page);

    await open(page, '/contato');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Contato');
    await expect(page.getByTestId('contact-phone')).toHaveAttribute('href', 'tel:+551938041658');
    await page.getByRole('button', { name: 'Mostrar mapa' }).click();
    await expect(page.locator('iframe')).toHaveCount(1);
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});
