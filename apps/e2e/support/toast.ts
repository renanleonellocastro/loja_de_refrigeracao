import { expect, type Page } from '@playwright/test';

/**
 * Waits for the toast with this title and closes every toast on screen, as a person taps their close buttons. Toasts
 * stay for 5 s and a click on anything they cover (the phone header, the desktop bottom right corner) waits until they
 * leave on their own. The close buttons are clicked in a single pass inside the page, so a toast that expires
 * meanwhile cannot leave a click waiting for it.
 */
export async function closeToast(page: Page, title: string | RegExp): Promise<void> {
  const region = page.getByRole('region', { name: 'Notificações' });
  await expect(region.getByText(title)).toBeVisible();
  const close = region.getByRole('button', { name: 'Fechar notificação' });
  await close.evaluateAll((buttons) => buttons.forEach((button) => (button as HTMLButtonElement).click()));
  await expect(close).toHaveCount(0);
}

/** Closes the welcome toast shown after signing in. */
export async function closeWelcomeToast(page: Page): Promise<void> {
  await closeToast(page, /Que bom te ver/);
}
