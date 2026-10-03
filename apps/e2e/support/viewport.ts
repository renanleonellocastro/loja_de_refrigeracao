import type { Page, TestInfo } from '@playwright/test';

export type Device = 'celular' | 'tablet' | 'desktop';

/** Device of the current Playwright project, named `<engine>-<device>` in playwright.config.ts. */
export function deviceOf(testInfo: TestInfo): Device {
  return testInfo.project.name.split('-').pop() as Device;
}

export async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}

/** Opens a page and waits until Vue has hydrated it, so clicks reach the components. */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === 'true');
}
