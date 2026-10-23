import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Fails the test on any WCAG 2.2 A or AA violation on the current page, naming the offending elements. */
export async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const violations = results.violations.map(
    (v) => `${v.id}: ${v.help} [${v.nodes.map((n) => n.target.join(' ')).join(' | ')}]`,
  );
  expect(violations).toEqual([]);
}

/**
 * Waits for toasts, dialogs and sheets to finish animating in, then runs expectAccessible, so contrast is checked on
 * the final colors instead of a frame of the fade. Endless animations, like skeletons and spinners, are not awaited.
 */
export async function expectAccessibleSettled(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
  await expectAccessible(page);
}
