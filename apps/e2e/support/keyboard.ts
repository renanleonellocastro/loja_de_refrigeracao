import type { Locator, Page } from '@playwright/test';

const MAX_TAB_PRESSES = 80;

async function hasFocus(target: Locator): Promise<boolean> {
  return target.evaluate((element) => element === document.activeElement);
}

type TabKey = 'Tab' | 'Shift+Tab';

/** True when the target comes before the focused element in document order, so Shift+Tab is the way back to it. */
async function isBehindFocus(target: Locator): Promise<boolean> {
  return target.evaluate((element) => {
    const focused = document.activeElement;
    if (!focused || focused === document.body) return false;
    return Boolean(focused.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING);
  });
}

/** Presses the key and tells whether the focus moved to another element. */
async function pressMovesFocus(page: Page, key: TabKey): Promise<boolean> {
  const before = await page.evaluateHandle(() => document.activeElement);
  await page.keyboard.press(key);
  const moved = await page.evaluate((element) => element !== document.activeElement, before);
  await before.dispose();
  return moved;
}

/**
 * Presses Tab until the target has focus, as a person on a keyboard would, so the test proves the control is in the
 * tab order instead of focusing it by script. A target behind the focus is reached with Shift+Tab, and the direction
 * turns when the focus stops moving: Firefox does not wrap from the last control of the page back to the first, its
 * focus leaves for the browser toolbar. Fails when the target is not reached within MAX_TAB_PRESSES.
 */
export async function tabTo(page: Page, target: Locator): Promise<void> {
  await target.waitFor();
  let key: TabKey = (await isBehindFocus(target)) ? 'Shift+Tab' : 'Tab';
  for (let presses = 0; presses < MAX_TAB_PRESSES; presses += 1) {
    if (!(await pressMovesFocus(page, key))) key = key === 'Tab' ? 'Shift+Tab' : 'Tab';
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
