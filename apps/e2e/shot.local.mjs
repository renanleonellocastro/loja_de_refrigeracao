// Scratch helper, never committed: node shot.local.mjs <name> <path> [role] [devices] [full]
import { chromium, devices } from '@playwright/test';

const [name, path, role, only, full] = process.argv.slice(2);
const OUT = '/private/tmp/claude-501/-Users-renan-workspace-personal/e7cc8d49-94af-440e-b322-3b5b7e4c7914/scratchpad/shots';
const BASE = process.env.BASE ?? 'http://localhost:3200';
const list = [
  ['celular', devices['Pixel 7']],
  ['tablet', devices['iPad (gen 7)']],
  ['desktop', { viewport: { width: 1440, height: 900 } }],
].filter(([d]) => !only || only.split(',').includes(d));
const browser = await chromium.launch();
for (const [device, opts] of list) {
  const context = await browser.newContext({
    ...opts,
    locale: 'pt-BR',
    colorScheme: process.env.DARK ? 'dark' : 'light',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('console', m.text()));
  if (role) {
    await page.goto(BASE + '/entrar');
    await page.waitForFunction(() => document.documentElement.dataset.hydrated === 'true');
    await page.getByLabel('Email').fill(role.includes('@') ? role : `${role}@castro.dev`);
    await page.getByLabel('Senha', { exact: true }).fill(process.env.PASSWORD ?? 'Castro-Dev-2026');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/entrar'));
  }
  await page.goto(BASE + path);
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === 'true');
  await page.waitForTimeout(Number(process.env.WAIT ?? 1200));
  if (process.env.ACTION) {
    const action = new Function('page', `return (async () => { ${process.env.ACTION} })()`);
    await action(page);
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: `${OUT}/${name}-${device}.png`, fullPage: Boolean(full) });
  await context.close();
}
await browser.close();
