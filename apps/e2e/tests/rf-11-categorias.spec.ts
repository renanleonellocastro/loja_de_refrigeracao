import { expect, test, type Page } from '@playwright/test';
import { expectAccessibleSettled } from '../support/a11y.js';
import { ADMIN, API, as, call, signInApi } from '../support/api.js';
import { signIn } from '../support/session.js';
import { closeToast } from '../support/toast.js';
import { deviceOf, open } from '../support/viewport.js';

function positionOf(page: Page, name: string) {
  return page
    .getByRole('list', { name: 'Categorias em ordem' })
    .getByRole('listitem')
    .filter({ hasText: name });
}

async function nameDialog(page: Page, title: string, name: string, action: string): Promise<void> {
  const dialog = page.getByRole('dialog', { name: title });
  await dialog.getByLabel('Nome da categoria').fill(name);
  await dialog.getByRole('button', { name: action }).click();
}

test.describe('RF-11 gerenciar categorias de produto', { tag: '@RF-11' }, () => {
  test('o super usuário cria, renomeia, ordena e exclui uma categoria', async ({ page }, testInfo) => {
    const stamp = `${testInfo.project.name} ${crypto.randomUUID().slice(0, 8)}`;
    const created = `Peças ${stamp}`;
    const renamed = `Peças de reposição ${stamp}`;
    await signIn(page, ADMIN);
    await open(page, '/categorias');
    await page.getByRole('button', { name: 'Nova categoria' }).click();
    await nameDialog(page, 'Nova categoria', created, 'Criar categoria');
    await closeToast(page, `Categoria ${created} criada.`);

    await page.getByRole('button', { name: `Renomear ${created}` }).click();
    await nameDialog(page, `Renomear ${created}`, renamed, 'Salvar nome');
    await closeToast(page, 'Categoria renomeada.');
    await expect(positionOf(page, renamed)).toBeVisible();
    await expectAccessibleSettled(page);

    // Every device writes the same list, so only one of them reorders it.
    if (deviceOf(testInfo) === 'desktop') {
      const before = Number(await positionOf(page, renamed).locator('span').first().textContent());
      await page.getByRole('button', { name: `Subir ${renamed}` }).click();
      await expect(positionOf(page, renamed).locator('span').first()).toHaveText(String(before - 1));
    }

    await page.getByRole('button', { name: `Excluir ${renamed}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Excluir categoria' }).click();
    await closeToast(page, `Categoria ${renamed} excluída.`);
    await expect(positionOf(page, renamed)).toHaveCount(0);
  });

  test('uma categoria com produtos só sai depois de mover os produtos', async ({
    page,
    request,
  }, testInfo) => {
    const admin = await signInApi(request, ADMIN);
    const name = `Usados ${testInfo.project.name} ${crypto.randomUUID().slice(0, 8)}`;
    const category = await call<{ id: number }>(
      request.post(`${API}/api/v1/categories`, { headers: as(admin, true), data: { name } }),
    );
    const product = { name: `Compressor usado ${name}`, categoryId: category.id, priceCents: 45_000 };
    await call(request.post(`${API}/api/v1/products`, { headers: as(admin, true), data: product }));

    await signIn(page, ADMIN);
    await open(page, '/categorias');
    await expect(positionOf(page, name)).toContainText('1 produto');
    await page.getByRole('button', { name: `Excluir ${name}` }).click();
    const dialog = page.getByRole('dialog', { name: `Excluir a categoria ${name}?` });
    await dialog.getByLabel('Mover produtos para').selectOption({ label: 'Geladeiras e refrigeradores' });
    await expectAccessibleSettled(page);
    await dialog.getByRole('button', { name: 'Mover e excluir' }).click();
    await closeToast(page, `Categoria ${name} excluída.`);
    await expect(positionOf(page, name)).toHaveCount(0);
  });
});
