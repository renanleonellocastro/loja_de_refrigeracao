import type { Locator, Page } from '@playwright/test';

const MAX_TAB_PRESSES = 80;

async function hasFocus(target: Locator): Promise<boolean> {
  return target.evaluate((element) => element === document.activeElement);
}

/**
 * Presses Tab until the target has focus, as a person on a keyboard would, so the test proves the control is in the
 * tab order instead of focusing it by script. Fails when the target is not reached within MAX_TAB_PRESSES.
 */
export async function tabTo(page: Page, target: Locator): Promise<void> {
  await target.waitFor();
  for (let presses = 0; presses < MAX_TAB_PRESSES; presses += 1) {
    await page.keyboard.press('Tab');
    if (await hasFocus(target)) return;
  }
  throw new Error(`Tab não chega em ${target.toString()}`);
}

/** Tabs to a field and types into it with the keyboard. */
export async function typeInto(page: Page, field: Locator, text: string): Promise<void> {
  await tabTo(page, field);
  await page.keyboard.type(text);
}

/** Tabs to a field, selects what it holds and types over it, as a person fixing a filled in value would. */
export async function retypeInto(page: Page, field: Locator, text: string): Promise<void> {
  await tabTo(page, field);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(text);
}

/** Tabs to a button or link and presses Enter on it. */
export async function activate(page: Page, control: Locator): Promise<void> {
  await tabTo(page, control);
  await page.keyboard.press('Enter');
}
