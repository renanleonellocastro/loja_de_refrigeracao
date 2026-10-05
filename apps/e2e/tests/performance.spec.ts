import { expect, test } from '@playwright/test';

const HTML = { accept: 'text/html', 'accept-encoding': 'br, gzip' };

test.describe('RNF-07 a RNF-09 HTML comprimido e páginas de erro', () => {
  test('páginas públicas saem comprimidas e sem prefetch', async ({ request }) => {
    for (const path of ['/', '/produtos', '/servicos']) {
      const response = await request.get(path, { headers: HTML });
      expect(response.status()).toBe(200);
      expect(response.headers()['content-encoding']).toMatch(/^(br|gzip)$/);
      expect(response.headers()['vary']).toContain('Accept-Encoding');
      const html = await response.text();
      expect(html).toContain('Refrigeração Castro');
      expect(html).not.toContain('rel="prefetch"');
    }
  });

  test('a página 404 continua legível com compressão pedida', async ({ request, page }) => {
    const response = await request.get('/pagina-que-nao-existe', { headers: HTML });
    expect(response.status()).toBe(404);
    expect(response.headers()['content-encoding']).toBeUndefined();
    expect(await response.text()).toContain('Erro 404');

    const missingProduct = await request.get('/produtos/produto-que-nao-existe', { headers: HTML });
    expect(missingProduct.status()).toBe(404);
    expect(await missingProduct.text()).toContain('Erro 404');

    await page.goto('/pagina-que-nao-existe');
    await expect(page.getByText('Erro 404')).toBeVisible();
  });
});
