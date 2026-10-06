import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from '../support/a11y.js';
import { hasHorizontalScroll, open } from '../support/viewport.js';

// Runs against the real API started by `pnpm --filter @rc/api e2e:stack` (development seed).
const PASSWORD = 'Castro-Dev-2026';

async function signIn(page: Page, email: string, landing: RegExp): Promise<void> {
  await open(page, '/entrar');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(landing);
}

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

test.describe('RF-24 tipos de reparo e manutenção', () => {
  test('o super usuário cadastra, altera, desativa e exclui um tipo de serviço', async ({
    page,
  }, testInfo) => {
    // Every device project writes to the same database, so the name is unique per run.
    const name = `Revisão ${testInfo.project.name} ${Date.now()}`;
    const edited = `${name} completa`;

    await signIn(page, 'admin@castro.dev', /\/painel/);
    await open(page, '/tipos-de-servico');
    await expect(page.getByRole('heading', { name: 'Tipos de serviço' })).toBeVisible();
    await expect(page.getByText('Conserto de geladeira').first()).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
    await checkA11y(page);

    await page.getByRole('button', { name: 'Novo serviço' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nome do serviço').fill(name);
    await dialog.getByLabel('Descrição').fill('Limpeza, carga de gás e testes de funcionamento.');
    await dialog.getByLabel('Duração estimada').fill('10');
    await dialog.getByRole('button', { name: 'Cadastrar serviço' }).click();
    await expect(dialog.getByText('Use um número inteiro de 15 a 1440 minutos.')).toBeVisible();
    await checkA11y(page);
    await dialog.getByLabel('Duração estimada').fill('90');
    await dialog.getByRole('button', { name: 'Cadastrar serviço' }).click();
    await expect(page.getByText(`Serviço ${name} cadastrado.`)).toBeVisible();
    const row = page.getByRole('listitem').filter({ hasText: name });
    await expect(row.getByText('Duração estimada: 1h30')).toBeVisible();

    await page.getByRole('button', { name: `Editar ${name}` }).click();
    await dialog.getByLabel('Nome do serviço').fill(edited);
    await dialog.getByLabel('Duração estimada').fill('120');
    await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByText(`Serviço ${edited} atualizado.`)).toBeVisible();
    const editedRow = page.getByRole('listitem').filter({ hasText: edited });
    await expect(editedRow.getByText('Duração estimada: 2h')).toBeVisible();

    await page.getByRole('button', { name: `Desativar ${edited}` }).click();
    await expect(page.getByText(`Serviço ${edited} desativado.`)).toBeVisible();
    await expect(editedRow.getByText('Inativo')).toBeVisible();
    await checkA11y(page);

    // Inactive types leave the public catalog of services.
    await open(page, '/servicos');
    await expect(page.getByRole('heading', { name: 'Conserto de geladeira' })).toBeVisible();
    await expect(page.getByRole('heading', { name: edited })).toHaveCount(0);

    await open(page, '/tipos-de-servico');
    await page.getByRole('button', { name: `Ativar ${edited}` }).click();
    await expect(page.getByText(`Serviço ${edited} ativado.`)).toBeVisible();
    await open(page, '/servicos');
    await expect(page.getByRole('heading', { name: edited })).toBeVisible();

    // Never used by a request or quote, so it is deleted for good.
    await open(page, '/tipos-de-servico');
    await page.getByRole('button', { name: `Excluir ${edited}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Excluir serviço' }).click();
    await expect(page.getByText(`Serviço ${edited} excluído.`)).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: edited })).toHaveCount(0);
  });

  test('o gerente não abre a página de tipos de serviço', async ({ page }) => {
    await signIn(page, 'gerente@castro.dev', /\/painel/);
    await expect(page.getByRole('link', { name: 'Tipos de serviço' })).toHaveCount(0);
    await open(page, '/tipos-de-servico');
    await expect(page.getByText('Esta porta é só para a equipe')).toBeVisible();
  });
});
