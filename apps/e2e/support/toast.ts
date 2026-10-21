import { expect, type Page } from '@playwright/test';

/**
 * Closes the welcome toast shown after signing in, as a person taps its close button. On phones toasts sit above the
 * bottom bar, over the form buttons, for 5 s, and a click on a covered button waits until the toast leaves on its own.
 * The toast is awaited first, so it cannot appear after this returns; the close buttons are then clicked in a single
 * pass inside the page, so a toast that expires meanwhile cannot leave a click waiting for it.
 */
export async function closeWelcomeToast(page: Page): Promise<void> {
  const region = page.getByRole('region', { name: 'Notificações' });
  await expect(region.getByText(/Que bom te ver/)).toBeVisible();
  const close = region.getByRole('button', { name: 'Fechar notificação' });
  await close.evaluateAll((buttons) => buttons.forEach((button) => (button as HTMLButtonElement).click()));
  await expect(close).toHaveCount(0);
}
