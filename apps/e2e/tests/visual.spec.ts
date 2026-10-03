import { expect, test } from '@playwright/test';
import { open } from '../support/viewport.js';

/**
 * Visual regression per device. Baselines live per platform in tests/__screenshots__; a platform without
 * baselines records them on its first run (updateSnapshots: 'missing' in playwright.config.ts).
 */
test.describe('Visual', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce' });

  const pages = [
    { name: 'inicio', path: '/' },
    { name: 'area-gerente', path: '/design/area?papel=MANAGER' },
  ];

  for (const { name, path } of pages) {
    test(`${name} @visual`, async ({ page }) => {
      await open(page, path);
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`${name}.png`, {
        animations: 'disabled',
        mask: [page.getByRole('link', { name: /WhatsApp/ })],
        maxDiffPixelRatio: 0.01,
      });
    });
  }

  test('area-gerente escuro @visual', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await open(page, '/design/area?papel=MANAGER');
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('area-gerente-escuro.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    });
  });
});
