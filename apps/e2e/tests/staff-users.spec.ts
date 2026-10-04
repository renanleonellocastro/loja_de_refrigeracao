import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from '../support/a11y.js';
import { open } from '../support/viewport.js';

// Runs against the real API started by `pnpm --filter @rc/api e2e:stack` (development seed).
const PASSWORD = 'Castro-Dev-2026';

async function signIn(page: Page, email: string, landing: RegExp): Promise<void> {
  await open(page, '/entrar');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(landing);
}

/** A valid CPF that no other run used, since every device project writes to the same database. */
function uniqueCpf(): string {
  const base = String(Date.now() + Math.floor(Math.random() * 1000)).slice(-9);
  const digit = (digits: string, start: number) => {
    const sum = [...digits].reduce((acc, char, i) => acc + Number(char) * (start - i), 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = digit(base, 10);
  return `${base}${first}${digit(`${base}${first}`, 11)}`;
}

test.describe('RF-05, RF-07 e RF-08 cadastros da equipe', () => {
  test('o gerente busca e cadastra um cliente', async ({ page }, testInfo) => {
    await signIn(page, 'gerente@castro.dev', /\/painel/);
    await open(page, '/clientes');
    await page.getByLabel('Buscar clientes').fill('Ana');
    await expect(page.getByRole('link', { name: 'Ana Cliente' }).first()).toBeVisible();
    await expectAccessible(page);

    const name = `Cliente ${testInfo.project.name} ${Date.now()}`;
    await page.getByRole('button', { name: 'Cadastrar cliente' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Enviamos um convite por email')).toBeVisible();
    // The sheet fades in; checking contrast mid animation would read the faded colors.
    await dialog.evaluate((element) =>
      Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)),
    );
    await expectAccessible(page);
    await dialog.getByLabel('Nome completo').fill(name);
    await dialog.getByLabel('Email').fill(`e2e.${testInfo.project.name}.${Date.now()}@exemplo.com`);
    await dialog.getByLabel('Telefone').fill('19999998888');
    await dialog.getByRole('button', { name: 'Cadastrar e enviar convite' }).click();
    await expect(page.getByText(/foi cadastrado\./)).toBeVisible();

    await page.getByLabel('Buscar clientes').fill(name);
    await page.getByRole('link', { name }).first().click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await expect(page.getByText('Convite pendente')).toBeVisible();
    await expectAccessible(page);
  });

  test('o super usuário cadastra um colaborador e confere a auditoria', async ({ page }, testInfo) => {
    await signIn(page, 'admin@castro.dev', /\/painel/);
    await open(page, '/colaboradores');
    await expect(page.getByRole('link', { name: 'Paulo Técnico' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Cadastrar colaborador' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nome completo').fill(`Técnico ${testInfo.project.name}`);
    await dialog.getByLabel('Email').fill(`tecnico.${testInfo.project.name}.${Date.now()}@exemplo.com`);
    await dialog.getByLabel('CPF').fill('11111111111');
    await dialog.getByRole('button', { name: 'Cadastrar e enviar convite' }).click();
    await expect(dialog.getByText('Esse CPF não existe. Confira os números.')).toBeVisible();
    await dialog.getByLabel('CPF').fill(uniqueCpf());
    await dialog.getByRole('button', { name: 'Cadastrar e enviar convite' }).click();
    await expect(page.getByText(/foi cadastrado\./)).toBeVisible();

    await open(page, '/auditoria');
    await expect(page.getByText('Cadastro em Usuários').first()).toBeVisible();
    await expectAccessible(page);
    await open(page, '/configuracoes');
    await expect(page.getByRole('heading', { name: 'Horário de funcionamento' })).toBeVisible();
    await expectAccessible(page);
  });

  test('o gerente não abre a página de gerentes', async ({ page }) => {
    await signIn(page, 'gerente@castro.dev', /\/painel/);
    await open(page, '/clientes');
    await expect(page.getByLabel('Buscar clientes')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Gerentes' })).toHaveCount(0);
    await open(page, '/gerentes');
    await expect(page.getByText('Esta porta é só para a equipe')).toBeVisible();
  });
});
