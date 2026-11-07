import { expect, test, type Page } from '@playwright/test';
import { deviceOf, open } from '../support/viewport.js';

// The policy is only sent by the production build (the Vite dev server needs inline scripts), so this spec runs
// against `node apps/web/.output/server/index.mjs` with E2E_BASE_URL set (CI job "lighthouse", docs/TESTES.md).
const PASSWORD = 'Castro-Dev-2026';
const PUBLIC_PAGES = [
  '/',
  '/produtos',
  '/produtos/compressor-embraco-1-4-hp',
  '/servicos',
  '/sobre',
  '/contato',
  '/privacidade',
  '/entrar',
  '/criar-conta',
  '/carrinho',
  '/design',
  '/pagina-que-nao-existe',
];
const STAFF_PAGES = [
  '/painel',
  '/hoje',
  '/solicitacoes',
  '/orcamentos',
  '/pedidos',
  '/balcao',
  '/produtos/gerenciar',
  '/clientes',
  '/configuracoes',
  '/auditoria',
  '/perfil',
];
const CUSTOMER_PAGES = ['/agendar', '/orcamento', '/minha-conta/pedidos', '/minha-conta/agendamentos'];

declare global {
  interface Window {
    cspViolations: string[];
  }
}

/** Records every blocked script, style or attribute from the first byte of each document on. */
async function watchViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.cspViolations.push(`${event.violatedDirective} ${event.blockedURI} ${event.sample}`.trim());
    });
  });
}

async function expectNoViolations(page: Page, label: string): Promise<void> {
  expect(await page.evaluate(() => window.cspViolations), label).toEqual([]);
}

async function visitAll(page: Page, paths: readonly string[]): Promise<void> {
  for (const path of paths) {
    await open(page, path);
    await page.waitForLoadState('networkidle');
    await expectNoViolations(page, path);
  }
}

async function signIn(page: Page, email: string): Promise<void> {
  await open(page, '/entrar');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
}

// A service worker answer would hide the response of the server and its policy.
test.use({ serviceWorkers: 'block' });

test.describe('ASVS 14.4.3 CSP sem unsafe-inline', () => {
  test.beforeEach(async ({ page, request }) => {
    const policy = (await request.get('/')).headers()['content-security-policy'];
    test.skip(!policy, 'O servidor de desenvolvimento não envia CSP; rode contra o build de produção.');
    expect(policy).not.toContain('unsafe');
    await watchViolations(page);
  });

  test('páginas públicas sem violação', async ({ page }, testInfo) => {
    await visitAll(page, PUBLIC_PAGES);
    if (deviceOf(testInfo) === 'desktop') return;
    await open(page, '/');
    await page.getByRole('button', { name: 'Abrir menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    await expectNoViolations(page, 'menu');
  });

  test('área da equipe e agenda sem violação', async ({ page }, testInfo) => {
    await signIn(page, 'gerente@castro.dev');
    await visitAll(page, STAFF_PAGES);
    await visitAll(page, ['/agenda']);
    // Tablets and desktops show FullCalendar, whose own style element must carry the nonce.
    if (deviceOf(testInfo) !== 'celular') await expect(page.locator('.fc').first()).toBeVisible();
    await expectNoViolations(page, '/agenda');
  });

  test('área do cliente sem violação', async ({ page }) => {
    await signIn(page, 'cliente@castro.dev');
    await visitAll(page, CUSTOMER_PAGES);
  });
});
