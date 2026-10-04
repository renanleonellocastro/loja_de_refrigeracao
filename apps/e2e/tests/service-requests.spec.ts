import { expect, test, type Page } from '@playwright/test';
import { expectAccessible } from '../support/a11y.js';
import { open } from '../support/viewport.js';

// Runs against the real API started by `pnpm --filter @rc/api e2e:stack` (development seed).
const PASSWORD = 'Castro-Dev-2026';
const CUSTOMER = 'cliente@castro.dev';
const MANAGER = 'gerente@castro.dev';
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Waits for toasts and dialogs to finish fading in, so contrast is checked on the final colors. */
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

async function signOut(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
}

async function signIn(page: Page, email: string): Promise<void> {
  await open(page, '/entrar');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
}

async function next(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Continuar' }).click();
}

test.describe('RF-30 a RF-34 solicitações de visita', () => {
  test('cliente pede visita com foto, gerente pergunta, cliente responde e gerente aprova', async ({
    page,
  }, testInfo) => {
    const problem = `Geladeira não gela embaixo (${testInfo.project.name} ${Date.now()}).`;

    // The services page is public; booking asks to sign in and comes back to the form.
    await open(page, '/servicos');
    await expect(page.getByRole('heading', { level: 1, name: 'Serviços' })).toBeVisible();
    await checkA11y(page);
    await page.getByRole('link', { name: 'Agendar visita: Conserto de geladeira' }).click();
    await expect(page).toHaveURL(/\/entrar\?redirect=/);
    await page.getByLabel('Email').fill(CUSTOMER);
    await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page).toHaveURL(/\/agendar\?servico=\d+$/);

    const title = page.getByTestId('step-title');
    await expect(title).toHaveText('Qual serviço você precisa?');
    await expect(page.getByRole('radio', { name: /Conserto de geladeira/ })).toBeChecked();
    await checkA11y(page);
    await next(page);

    await expect(title).toHaveText('Qual é o aparelho?');
    await page.getByLabel('Aparelho').fill('Geladeira duplex');
    await page.getByLabel('Marca').fill('Brastemp');
    await next(page);

    await expect(title).toHaveText('O que está acontecendo?');
    await page.getByLabel('Problema').fill(problem);
    await page.locator('input[type="file"][multiple]').setInputFiles({
      name: 'defeito.png',
      mimeType: 'image/png',
      buffer: PIXEL,
    });
    await expect(page.getByText('1 de 6 fotos')).toBeVisible();
    await checkA11y(page);
    await next(page);

    await expect(title).toHaveText('Quais dias ficam bons?');
    await page.getByLabel('Período').selectOption('AFTERNOON');
    await page.getByRole('button', { name: 'Adicionar data' }).click();
    await expect(page.getByRole('list', { name: 'Datas escolhidas' }).getByRole('listitem')).toHaveCount(1);
    await checkA11y(page);
    await next(page);

    await expect(title).toHaveText('Onde vai ser a visita?');
    const other = page.getByRole('radio', { name: 'Outro endereço' });
    if (await other.isVisible()) await other.check();
    await page.getByLabel('CEP').fill('13800061');
    await expect(page.getByText(/Achamos!|Não achamos esse CEP/)).toBeVisible();
    await page.getByLabel('Rua').fill('Rua Doutor Ulhoa Cintra');
    await page.getByLabel('Número').fill('91');
    await page.getByLabel('Bairro').fill('Centro');
    await page.getByLabel('Cidade').fill('Mogi Mirim');
    await page.getByLabel('UF').selectOption('SP');
    await checkA11y(page);
    await next(page);

    await expect(title).toHaveText('Confira e envie');
    await checkA11y(page);
    const created = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().endsWith('/api/v1/service-requests'),
    );
    const photos = page.waitForResponse((response) =>
      /\/service-requests\/\d+\/photos$/.test(response.url()),
    );
    await page.getByRole('button', { name: 'Enviar solicitação' }).click();
    expect((await created).headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    expect((await photos).status()).toBe(201);
    await expect(page.getByRole('heading', { name: 'Pronto! Recebemos sua solicitação.' })).toBeVisible();
    const id = (await page.getByTestId('request-number').textContent())!.trim();
    await checkA11y(page);

    await open(page, '/minha-conta/agendamentos');
    await expect(page.getByRole('link', { name: new RegExp(`Solicitação ${id}`) })).toBeVisible();
    await checkA11y(page);

    // The manager finds the request in the queue and asks a question.
    await signOut(page);
    await signIn(page, MANAGER);
    await open(page, '/solicitacoes');
    await page.getByLabel('Buscar solicitações').fill(id);
    await expect(page.getByRole('link', { name: `Solicitação ${id}` }).first()).toBeVisible();
    await checkA11y(page);
    await open(page, `/solicitacoes/${id}`);
    await expect(page.getByTestId('request-problem')).toHaveText(problem);
    await expect(page.getByRole('img', { name: /Foto 1 do problema/ })).toBeVisible();
    await page.getByLabel('Sua mensagem').fill('A geladeira faz algum barulho?');
    await page.getByRole('button', { name: 'Enviar mensagem' }).click();
    await expect(page.locator('[data-status="AWAITING_CUSTOMER"]')).toBeVisible();
    await checkA11y(page);

    // The customer answers and the request goes back to the queue.
    await signOut(page);
    await signIn(page, CUSTOMER);
    await open(page, `/minha-conta/agendamentos/${id}`);
    await expect(page.getByText('A geladeira faz algum barulho?')).toBeVisible();
    await expect(page.getByText('A loja fez uma pergunta.')).toBeVisible();
    await checkA11y(page);
    await page.getByLabel('Sua mensagem').fill('Faz um estalo de vez em quando.');
    await page.getByRole('button', { name: 'Enviar mensagem' }).click();
    await expect(page.locator('[data-status="REQUESTED"]')).toBeVisible();

    // The manager approves with a message and can schedule it.
    await signOut(page);
    await signIn(page, MANAGER);
    await open(page, `/solicitacoes/${id}`);
    await expect(page.getByText('Faz um estalo de vez em quando.')).toBeVisible();
    await page.getByRole('button', { name: 'Aprovar', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Mensagem para o cliente (opcional)').fill('Vamos marcar a visita.');
    await checkA11y(page);
    await dialog.getByRole('button', { name: 'Aprovar solicitação' }).click();
    await expect(page.locator('[data-status="APPROVED"]')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Marcar na agenda' })).toHaveAttribute(
      'href',
      `/agenda?solicitacao=${id}`,
    );
    await checkA11y(page);
  });
});
