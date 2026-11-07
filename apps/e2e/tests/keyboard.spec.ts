import { expect, test, type Page } from '@playwright/test';
import { uniqueEmail } from '../support/identity.js';
import { activate, retypeInto, tabTo, typeInto } from '../support/keyboard.js';
import { closeWelcomeToast } from '../support/toast.js';
import { open } from '../support/viewport.js';

// Runs against the real API started by `pnpm --filter @rc/api e2e:stack` (development seed).
// Every control here is reached with Tab and used with Enter, Space or typing; no clicks (RNF-06, #84).
const PASSWORD = 'Castro-Dev-2026';

/** Fills the sign up form with the keyboard only; the new customer ends signed in. */
async function createAccountByKeyboard(page: Page, email: string): Promise<void> {
  await open(page, '/criar-conta');
  await typeInto(page, page.getByLabel('Nome completo'), 'Teste Teclado');
  await typeInto(page, page.getByLabel('Email'), email);
  await typeInto(page, page.getByLabel('Telefone'), '19999996666');
  await typeInto(page, page.locator('input[autocomplete="new-password"]').nth(0), PASSWORD);
  await typeInto(page, page.locator('input[autocomplete="new-password"]').nth(1), PASSWORD);
  await tabTo(page, page.getByRole('checkbox', { name: /política de privacidade/ }));
  await page.keyboard.press('Space');
  await activate(page, page.getByRole('button', { name: 'Criar minha conta' }));
  await expect(page.getByText('Pronto, Teste! Sua conta está criada.')).toBeVisible();
}

/** Signs in with the keyboard only, submitting the form with Enter from the password field. */
async function signInByKeyboard(page: Page, email: string): Promise<void> {
  await typeInto(page, page.getByLabel('Email'), email);
  await typeInto(page, page.locator('input[autocomplete="current-password"]'), PASSWORD);
  await page.keyboard.press('Enter');
  await expect(page).not.toHaveURL(/\/entrar/);
  await closeWelcomeToast(page);
}

/** Fills the visit address with the keyboard; the store CEP lookup may fill some fields first, so each is retyped. */
async function fillAddressByKeyboard(page: Page): Promise<void> {
  await typeInto(page, page.getByLabel('CEP'), '13800061');
  await expect(page.getByText(/Achamos!|Não achamos esse CEP/)).toBeVisible();
  await retypeInto(page, page.getByLabel('Rua'), 'Rua Doutor Ulhoa Cintra');
  await retypeInto(page, page.getByLabel('Número'), '91');
  await retypeInto(page, page.getByLabel('Bairro'), 'Centro');
  await retypeInto(page, page.getByLabel('Cidade'), 'Mogi Mirim');
  // Typing on a focused select picks the option that starts with those letters.
  await tabTo(page, page.getByLabel('UF'));
  await page.keyboard.type('SP');
  await expect(page.getByLabel('UF')).toHaveValue('SP');
}

async function forgetSession(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
}

/** Moves to the next step of the booking form with Enter on "Continuar"; focus lands on the new step title. */
async function nextStep(page: Page, title: string): Promise<void> {
  await activate(page, page.getByRole('button', { name: 'Continuar' }));
  const heading = page.getByTestId('step-title');
  await expect(heading).toHaveText(title);
  await expect(heading).toBeFocused();
}

test.describe('RNF-06 navegação por teclado', () => {
  test('o primeiro Tab mostra o atalho para o conteúdo', async ({ page }) => {
    await open(page, '/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press('Enter');
    await expect(page.locator('#conteudo')).toBeFocused();
  });

  test('cria a conta, sai e entra de novo só com o teclado', async ({ page }, testInfo) => {
    const email = uniqueEmail('teclado', testInfo);
    await createAccountByKeyboard(page, email);
    await forgetSession(page);
    await open(page, '/perfil');
    await expect(page).toHaveURL(/\/entrar\?redirect=/);
    await signInByKeyboard(page, email);
    await expect(page).toHaveURL(/\/perfil$/);
    await expect(page.getByRole('heading', { name: 'Seus dados' })).toBeVisible();
  });

  test('compra um produto só com o teclado', async ({ page }, testInfo) => {
    await createAccountByKeyboard(page, uniqueEmail('teclado.compra', testInfo));
    await open(page, '/produtos/compressor-embraco-1-4-hp');
    await activate(page, page.getByRole('button', { name: 'Aumentar quantidade' }));
    await activate(page, page.getByRole('button', { name: 'Adicionar ao carrinho' }));
    await expect(page.getByRole('link', { name: 'Carrinho com 2 itens' })).toBeVisible();
    await activate(page, page.getByRole('link', { name: 'Carrinho com 2 itens' }));
    await expect(page.getByRole('heading', { name: 'Resumo' })).toBeVisible();
    await activate(page, page.getByRole('link', { name: 'Fechar pedido' }));
    await expect(page).toHaveURL(/\/carrinho\/finalizar$/);
    await activate(page, page.getByRole('button', { name: 'Confirmar pedido' }));
    await expect(page.getByRole('heading', { name: 'Pronto! Recebemos seu pedido.' })).toBeVisible();
    // Canceling gives the stock back, so repeated runs keep finding the product available.
    const number = (await page.getByTestId('order-number').textContent())!.trim();
    await open(page, '/minha-conta/pedidos');
    await activate(page, page.getByRole('link', { name: new RegExp(`Pedido ${number}`) }));
    await activate(page, page.getByRole('button', { name: 'Cancelar pedido' }));
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await activate(page, dialog.getByRole('button', { name: 'Cancelar pedido' }));
    await expect(page.getByText('Pedido cancelado. Os itens voltaram para a loja.')).toBeVisible();
  });

  test('pede uma visita técnica só com o teclado', async ({ page }, testInfo) => {
    // A new customer has no address on file, so the address step is filled with the keyboard too.
    await createAccountByKeyboard(page, uniqueEmail('teclado.visita', testInfo));
    await open(page, '/agendar');
    await expect(page.getByTestId('step-title')).toHaveText('Qual serviço você precisa?');
    // Arrow keys move the choice inside the radio group, as in any native radio group.
    await tabTo(page, page.getByRole('radio').first());
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio').nth(1)).toBeChecked();
    await nextStep(page, 'Qual é o aparelho?');
    await typeInto(page, page.getByLabel('Aparelho'), 'Ar condicionado split');
    await nextStep(page, 'O que está acontecendo?');
    await typeInto(page, page.getByLabel('Problema'), `Pinga água (${testInfo.project.name} ${Date.now()}).`);
    await nextStep(page, 'Quais dias ficam bons?');
    await activate(page, page.getByRole('button', { name: 'Adicionar data' }));
    await expect(page.getByRole('list', { name: 'Datas escolhidas' }).getByRole('listitem')).toHaveCount(1);
    await nextStep(page, 'Onde vai ser a visita?');
    await fillAddressByKeyboard(page);
    await nextStep(page, 'Confira e envie');
    await activate(page, page.getByRole('button', { name: 'Enviar solicitação' }));
    await expect(page.getByRole('heading', { name: 'Pronto! Recebemos sua solicitação.' })).toBeVisible();
  });
});
