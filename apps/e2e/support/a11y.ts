import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Fails the test on any WCAG 2.2 A or AA violation on the current page. */
export async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}
