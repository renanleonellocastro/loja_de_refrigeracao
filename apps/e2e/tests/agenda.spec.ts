import { devices, expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { expectAccessibleSettled } from '../support/a11y.js';
import { deviceOf, open } from '../support/viewport.js';

// Runs against the real API started by `pnpm --filter @rc/api e2e:stack` (development seed).
const API = process.env.E2E_API_URL ?? 'http://localhost:3001';
const PASSWORD = 'Castro-Dev-2026';
const CUSTOMER = 'cliente@castro.dev';
const MANAGER = 'gerente@castro.dev';
const TECHNICIAN = 'tecnico@castro.dev';
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
// A visit takes 2h and the test moves it by 30 min, so 3h apart keeps the slots of a day disjoint.
const SLOTS_PER_DAY = 3;
const SLOT_HOURS = 3;
const FIRST_HOUR = 8;
// Two days ahead, so the visit window is still accepted when the test runs across midnight.
const LEAD_DAYS = 2;

async function signIn(page: Page, email: string): Promise<void> {
  await open(page, '/entrar');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
}

async function signOut(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
}

async function token(request: APIRequestContext, email: string): Promise<string> {
  const response = await request.post(`${API}/api/v1/auth/sessions`, { data: { email, password: PASSWORD } });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { accessToken: string }).accessToken;
}

/** YYYY-MM-DD in São Paulo, `days` from today. */
function dayFromToday(days: number): string {
  const date = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date);
}

/**
 * Day and hour of the visit for a request. Request ids never repeat in the E2E database, so devices, retries
 * and repeated runs each get their own slot and never find the technician busy.
 */
function visitSlot(requestId: number): { day: string; hour: string } {
  return {
    day: dayFromToday(LEAD_DAYS + Math.floor(requestId / SLOTS_PER_DAY)),
    hour: String(FIRST_HOUR + (requestId % SLOTS_PER_DAY) * SLOT_HOURS).padStart(2, '0'),
  };
}

/** A customer request approved by the store, created through the API to keep the test on the agenda. */
async function approvedRequest(request: APIRequestContext, problem: string): Promise<number> {
  const customer = await token(request, CUSTOMER);
  const types = (await (await request.get(`${API}/api/v1/service-types`)).json()) as Array<{
    id: number;
    name: string;
  }>;
  const created = await request.post(`${API}/api/v1/service-requests`, {
    headers: { authorization: `Bearer ${customer}`, 'idempotency-key': crypto.randomUUID() },
    data: {
      serviceTypeId: types.find((type) => type.name === 'Conserto de geladeira')!.id,
      productKind: 'Geladeira duplex',
      problem,
      windows: [{ day: dayFromToday(LEAD_DAYS), period: 'AFTERNOON' }],
      address: {
        cep: '13800061',
        street: 'Rua Doutor Ulhoa Cintra',
        number: '91',
        district: 'Centro',
        city: 'Mogi Mirim',
        state: 'SP',
      },
    },
  });
  expect(created.status()).toBe(201);
  const id = ((await created.json()) as { id: number }).id;
  const manager = await token(request, MANAGER);
  const approved = await request.post(`${API}/api/v1/service-requests/${id}/approval`, {
    headers: { authorization: `Bearer ${manager}` },
    data: {},
  });
  expect(approved.ok()).toBe(true);
  return id;
}

test.describe('RF-35 a RF-38 agenda, finalização e aprovação', () => {
  test('gerente agenda, técnico finaliza no celular e gerente aprova com valor', async ({
    page,
    browser,
    request,
  }, testInfo) => {
    // Two people, two browsers and nine axe scans take about 25 s on CI, and the first device also waits for the
    // dev server to compile the agenda pages, so the default 30 s budget is too tight.
    test.slow();
    // Parallel runs can start in the same millisecond, so the texts that find this visit use a random id.
    const stamp = `${testInfo.project.name} ${crypto.randomUUID()}`;
    const problem = `Geladeira desarmando (${stamp}).`;
    const repair = `Troca do relé de partida (${stamp}).`;
    const requestId = await approvedRequest(request, problem);
    const { day, hour } = visitSlot(requestId);

    // The manager schedules the approved request from the agenda.
    await signIn(page, MANAGER);
    await open(page, `/agenda?solicitacao=${requestId}`);
    const dialog = page.getByRole('dialog', { name: `Agendar solicitação ${requestId}` });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: /tarde/ })).toBeVisible();
    await dialog.getByRole('combobox', { name: 'Técnico' }).selectOption({ label: 'Paulo Técnico' });
    await dialog.getByRole('textbox', { name: 'Dia' }).fill(day);
    await dialog.getByLabel('Início').fill(`${hour}:00`);
    await expect(dialog.getByLabel('Duração')).toHaveValue('120');
    await expectAccessibleSettled(page);
    await dialog.getByRole('button', { name: 'Agendar visita' }).click();
    await expect(page).toHaveURL(/\/agenda\/\d+$/);
    const appointmentId = page.url().split('/').pop()!;
    await expect(page.getByTestId('appointment-problem')).toHaveText(problem);
    await expect(page.locator('[data-status="SCHEDULED"]')).toBeVisible();
    await expect(page.getByText(`${hour}:00 às`)).toBeVisible();
    await expectAccessibleSettled(page);

    // Rescheduling sends If-Match with the ETag of the visit on screen.
    await page.getByRole('button', { name: 'Remarcar' }).click();
    const edit = page.getByRole('dialog', { name: 'Remarcar atendimento' });
    await edit.getByRole('textbox', { name: 'Início' }).fill(`${hour}:30`);
    const patch = page.waitForRequest((request) => request.method() === 'PATCH');
    await edit.getByRole('button', { name: 'Salvar alteração' }).click();
    expect((await patch).headers()['if-match']).toMatch(/^W\/"\d+"$/);
    await expect(page.getByText(`${hour}:30 às`)).toBeVisible();

    await open(page, '/agenda');
    if (deviceOf(testInfo) === 'celular') {
      await expect(page.getByRole('button', { name: 'Próximo dia' })).toBeVisible();
    } else {
      await expect(page.locator('.fc-timegrid')).toBeVisible();
    }
    await expectAccessibleSettled(page);

    // The technician finalizes on a phone, with a photo taken in the visit.
    const phone = await browser.newContext({
      ...devices['Pixel 7'],
      baseURL: testInfo.project.use.baseURL,
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
    });
    const technician = await phone.newPage();
    await signIn(technician, TECHNICIAN);
    await open(technician, '/hoje');
    await expect(technician.getByTestId('today-summary')).toBeVisible();
    await expectAccessibleSettled(technician);
    await open(technician, `/agenda/${appointmentId}`);
    await expect(technician.getByRole('link', { name: '(19) 99999-0004' })).toHaveAttribute(
      'href',
      'tel:19999990004',
    );
    await expect(technician.getByRole('link', { name: 'Abrir rota no mapa' })).toHaveAttribute(
      'href',
      /google\.com\/maps/,
    );
    await technician.getByLabel('Sim, encontrei defeito').check();
    await technician.getByLabel('Descrição do defeito').fill('Relé de partida queimado.');
    await technician.getByLabel('Reparo realizado').fill(repair);
    await technician.locator('input[type="file"][multiple]').setInputFiles({
      name: 'servico.png',
      mimeType: 'image/png',
      buffer: PIXEL,
    });
    await expect(technician.getByText('1 de 8 fotos')).toBeVisible();
    await expectAccessibleSettled(technician);
    const photos = technician.waitForResponse((response) =>
      /\/appointments\/\d+\/report\/photos$/.test(response.url()),
    );
    await technician.getByRole('button', { name: 'Finalizar serviço' }).click();
    expect((await photos).status()).toBe(201);
    await expect(technician.locator('[data-status="AWAITING_COMPLETION_APPROVAL"]')).toBeVisible();
    await expect(technician.getByRole('img', { name: /Foto 1 do serviço/ })).toBeVisible();
    await expectAccessibleSettled(technician);
    await phone.close();

    // The manager approves the report with the value of the service.
    await signOut(page);
    await signIn(page, MANAGER);
    await open(page, '/aprovacoes');
    const card = page.getByTestId('approval-card').filter({ hasText: repair });
    await expect(card).toBeVisible();
    await expectAccessibleSettled(page);
    await card.getByLabel('Valor do serviço').fill('18000');
    await card.getByRole('button', { name: 'Aprovar' }).click();
    await expect(page.getByText('Serviço aprovado e concluído.')).toBeVisible();
    await expect(card).toHaveCount(0);
    await expectAccessibleSettled(page);

    await open(page, `/agenda/${appointmentId}`);
    await expect(page.locator('[data-status="COMPLETED"]')).toBeVisible();
    await expect(page.getByTestId('report-amount')).toHaveText('R$ 180,00');
    await expectAccessibleSettled(page);
  });
});
