import { expect, type Page } from '@playwright/test';
import { PASSWORD } from './api.js';
import { closeWelcomeToast } from './toast.js';
import { open } from './viewport.js';

/** Signs in through the form and closes the welcome toast, so it covers nothing on the next step. */
export async function signIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  await open(page, '/entrar');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
  await closeWelcomeToast(page);
}

/** Drops the session without the account menu, which only some pages show. */
export async function signOut(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
}
