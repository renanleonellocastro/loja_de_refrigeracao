import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { ADMIN, API, as, call, signInApi } from '../support/api.js';
import { signIn } from '../support/session.js';
import { open } from '../support/viewport.js';

/**
 * Captures the images of docs/MANUAL.md and the README against the development seed with photos and sample activity
 * (pnpm --filter @rc/api manual:stack). The ids below are the ones that seed creates on a fresh database.
 */
type Account = 'admin' | 'gerente' | 'tecnico' | 'cliente';

interface Shot {
  readonly file: string;
  readonly path: string;
  readonly account?: Account;
  readonly fullPage?: boolean;
  readonly prepare?: (page: Page) => Promise<void>;
  readonly cleanUp?: (page: Page) => Promise<void>;
}

const DOCS = path.resolve(import.meta.dirname, '../../../docs/assets');
// Keeps the files light for the repository, like the images they replace.
const WEBP_QUALITY = 80;

async function addToCart(page: Page): Promise<void> {
  await open(page, '/produtos/bebedouro-de-coluna-libell-press-flex');
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click();
  await page
    .getByRole('region', { name: 'Notificações' })
    .getByText(/carrinho/i)
    .waitFor();
}

/** Leaves the cart empty again, so the cart badge does not show on the other screenshots. */
async function emptyCart(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Remover / }).click();
  await page.getByText('Seu carrinho está vazio').waitFor();
}

/** A price change and a stock entry by the owner, so the audit trail has something to show. */
async function auditSomething(page: Page): Promise<void> {
  const admin = await signInApi(page.request, ADMIN);
  const product = await page.request.get(`${API}/api/v1/products/12`);
  const headers = { ...as(admin), 'if-match': product.headers().etag! };
  await call(page.request.patch(`${API}/api/v1/products/12`, { headers, data: { priceCents: 62_900 } }));
  const entry = { type: 'IN', quantity: 4, reason: 'Compra do fornecedor' };
  await call(
    page.request.post(`${API}/api/v1/products/13/stock-movements`, { headers: as(admin, true), data: entry }),
  );
}

const DESKTOP: readonly Shot[] = [
  { file: 'telas/inicio', path: '/' },
  { file: 'telas/produtos', path: '/produtos' },
  {
    file: 'manual/cliente-produto',
    path: '/produtos/geladeira-brastemp-frost-free-duplex-375l',
    account: 'cliente',
  },
  {
    file: 'manual/cliente-carrinho',
    path: '/carrinho',
    account: 'cliente',
    prepare: addToCart,
    cleanUp: emptyCart,
  },
  { file: 'manual/cliente-agendamentos', path: '/minha-conta/agendamentos', account: 'cliente' },
  { file: 'manual/cliente-orcamento', path: '/minha-conta/orcamentos/2', account: 'cliente' },
  { file: 'manual/cliente-pedidos', path: '/minha-conta/pedidos', account: 'cliente' },
  { file: 'manual/colaborador-agenda', path: '/agenda', account: 'tecnico' },
  { file: 'manual/colaborador-balcao', path: '/balcao', account: 'tecnico' },
  { file: 'telas/painel', path: '/painel', account: 'gerente' },
  { file: 'manual/gerente-pedidos', path: '/pedidos', account: 'gerente' },
  { file: 'manual/gerente-solicitacoes', path: '/solicitacoes', account: 'gerente' },
  { file: 'manual/gerente-solicitacao', path: '/solicitacoes/2', account: 'gerente' },
  { file: 'manual/gerente-agenda', path: '/agenda', account: 'gerente' },
  { file: 'manual/gerente-orcamentos', path: '/orcamentos', account: 'gerente' },
  { file: 'manual/gerente-produtos', path: '/produtos/gerenciar', account: 'gerente' },
  { file: 'manual/gerente-cliente', path: '/clientes/4', account: 'gerente', fullPage: true },
  { file: 'manual/admin-colaboradores', path: '/colaboradores', account: 'admin' },
  { file: 'manual/admin-colaborador', path: '/colaboradores/3', account: 'admin', fullPage: true },
  { file: 'manual/admin-configuracoes', path: '/configuracoes', account: 'admin' },
  { file: 'manual/admin-categorias', path: '/categorias', account: 'admin' },
  { file: 'manual/admin-auditoria', path: '/auditoria', account: 'admin', prepare: auditSomething },
];

const PHONE: readonly Shot[] = [
  { file: 'manual/cliente-criar-conta', path: '/criar-conta' },
  { file: 'manual/cliente-agendar', path: '/agendar', account: 'cliente' },
  { file: 'manual/colaborador-hoje', path: '/hoje', account: 'tecnico' },
  { file: 'manual/colaborador-atendimento', path: '/agenda/1', account: 'tecnico' },
];

/** Waits until requests settle and every visible image has loaded, so no placeholder ends up in the picture. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() =>
    [...document.images]
      .filter((image) => image.checkVisibility() && image.getBoundingClientRect().top < window.innerHeight)
      .every((image) => image.complete),
  );
  await page.evaluate(() => document.fonts.ready);
}

async function capture(page: Page, shot: Shot): Promise<void> {
  if (shot.account) await signIn(page, `${shot.account}@castro.dev`);
  await shot.prepare?.(page);
  await open(page, shot.path);
  await settle(page);
  const png = await page.screenshot({ fullPage: shot.fullPage, animations: 'disabled', caret: 'hide' });
  const target = path.join(DOCS, `${shot.file}.webp`);
  mkdirSync(path.dirname(target), { recursive: true });
  await sharp(png).webp({ quality: WEBP_QUALITY }).toFile(target);
  await shot.cleanUp?.(page);
}

for (const shot of DESKTOP) {
  test(shot.file, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop');
    await capture(page, shot);
  });
}

for (const shot of PHONE) {
  test(shot.file, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'celular');
    await capture(page, shot);
  });
}
