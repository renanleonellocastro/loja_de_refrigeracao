import type { Page, TestInfo } from '@playwright/test';

export type Device = 'celular' | 'tablet' | 'desktop';

/** Device of the current Playwright project, named `<engine>-<device>` in playwright.config.ts. */
export function deviceOf(testInfo: TestInfo): Device {
  return testInfo.project.name.split('-').pop() as Device;
}

/**
 * Compares the page with the device width, not with window.innerWidth: phone browsers widen the layout viewport to
 * fit content that overflows, so innerWidth grows with the page and would hide the overflow.
 */
export async function hasHorizontalScroll(page: Page): Promise<boolean> {
  const deviceWidth = page.viewportSize()!.width;
  return page.evaluate((width) => document.documentElement.scrollWidth > width, deviceWidth);
}

/** Opens a page and waits until Vue has hydrated it, so clicks reach the components. */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === 'true');
}
