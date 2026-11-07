import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { expectAccessibleSettled } from '../support/a11y.js';
import { deviceOf, hasHorizontalScroll, open } from '../support/viewport.js';

// Runs against the real API started by `pnpm --filter @rc/api e2e:stack` (development seed, which has no photos).
const API = process.env.E2E_API_URL ?? 'http://localhost:3001';
const PASSWORD = 'Castro-Dev-2026';
const MANAGER = 'gerente@castro.dev';
const SEEDED_PRODUCT = 'compressor-embraco-1-4-hp';
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function managerToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API}/api/v1/auth/sessions`, {
    data: { email: MANAGER, password: PASSWORD },
  });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { accessToken: string }).accessToken;
}

/** A product of its own for each device and run, with two photos, so parallel runs never share a gallery. */
async function productWithTwoPhotos(request: APIRequestContext, name: string): Promise<string> {
  const headers = { authorization: `Bearer ${await managerToken(request)}` };
  const seeded = await request.get(`${API}/api/v1/products/${SEEDED_PRODUCT}`);
  const { categoryId } = (await seeded.json()) as { categoryId: number };
  const created = await request.post(`${API}/api/v1/products`, {
    headers,
    data: { name, categoryId, priceCents: 19900, initialStock: 2 },
  });
  expect(created.ok()).toBe(true);
  const { id, slug } = (await created.json()) as { id: number; slug: string };
  const photo = (file: string) => ({ name: file, mimeType: 'image/png', buffer: PIXEL });
  const uploaded = await request.post(`${API}/api/v1/products/${id}/images`, {
    headers,
    multipart: { first: photo('frente.png'), second: photo('lado.png') },
  });
  expect(uploaded.status()).toBe(201);
  return slug;
}

test.describe('RF-15 zoom da galeria do produto', { tag: '@RF-15' }, () => {
  test('abre a foto em tela cheia, amplia pelo teclado, botões e toque duplo, troca de foto e devolve o foco', async ({
    page,
    request,
  }, testInfo) => {
    const name = `Compressor zoom ${testInfo.project.name} ${Date.now()}`;
    await open(page, `/produtos/${await productWithTwoPhotos(request, name)}`);
    const trigger = page.getByRole('button', { name: 'Ampliar foto 1' });
    await trigger.click();

    const viewer = page.getByRole('dialog', { name });
    await expect(viewer).toBeVisible();
    const stage = viewer.getByRole('group', { name: 'Foto 1 de 2' });
    await expect(stage).toBeFocused();
    await expectAccessibleSettled(page);
    expect(await hasHorizontalScroll(page)).toBe(false);

    await page.keyboard.press('+');
    await expect(viewer.getByText('150%')).toBeVisible();
    await page.keyboard.press('0');
    await expect(viewer.getByText('100%')).toBeVisible();
    await viewer.getByRole('button', { name: 'Ampliar' }).click();
    await expect(viewer.getByText('150%')).toBeVisible();
    await viewer.getByRole('button', { name: 'Reduzir' }).click();
    await expect(viewer.getByText('100%')).toBeVisible();
    await stage.dblclick();
    await expect(viewer.getByText('250%')).toBeVisible();
    await stage.dblclick();
    await expect(viewer.getByText('100%')).toBeVisible();

    await stage.focus();
    await page.keyboard.press('ArrowRight');
    await expect(viewer.getByRole('group', { name: 'Foto 2 de 2' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(viewer).toBeHidden();
    await expect(page.getByRole('button', { name: 'Ampliar foto 2' })).toBeFocused();
  });
});

/** Two fingers moving apart from the center of the box, sent as real touch events through the Chromium protocol. */
async function pinchOut(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
): Promise<void> {
  const session = await page.context().newCDPSession(page);
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const fingers = (spread: number) => [
    { x: center.x - spread, y: center.y, id: 1 },
    { x: center.x + spread, y: center.y, id: 2 },
  ];
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(20) });
  for (const spread of [40, 60, 80, 100]) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(spread) });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('no celular, afastar dois dedos amplia a foto', async ({ page, request, browserName }, testInfo) => {
  test.skip(
    browserName !== 'chromium' || deviceOf(testInfo) !== 'celular',
    'Toque real só pelo protocolo do Chromium.',
  );
  const name = `Compressor pinça ${testInfo.project.name} ${Date.now()}`;
  await open(page, `/produtos/${await productWithTwoPhotos(request, name)}`);
  await page.getByRole('button', { name: 'Ampliar foto 1' }).tap();
  const viewer = page.getByRole('dialog', { name });
  const stage = viewer.getByRole('group', { name: 'Foto 1 de 2' });
  await expect(stage).toBeVisible();
  await pinchOut(page, (await stage.boundingBox())!);
  // The fingers spread five times apart, past the 400% ceiling.
  await expect(viewer.getByText('400%')).toBeVisible();
});
