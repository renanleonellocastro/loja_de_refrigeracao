import { expect, test } from '@playwright/test';
import { open } from '../support/viewport.js';

/**
 * Visual regression per device. Baselines live per platform in tests/__screenshots__; a platform without
 * baselines records them on its first run (updateSnapshots: 'missing' in playwright.config.ts).
 */
test.describe('Visual', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce' });

  // The home page is captured from the hero, which does not depend on API data (baselines run without it).
  const pages = [
    { name: 'inicio', path: '/', target: '[data-testid="hero"]' },
    { name: 'area-gerente', path: '/design/area?papel=MANAGER', target: null },
  ];

  for (const { name, path, target } of pages) {
    test(`${name} @visual`, async ({ page }) => {
      await open(page, path);
      // The floating WhatsApp button follows the store settings and floats over the page: leave it out.
      await page.addStyleTag({ content: 'a[href^="https://wa.me/"] { display: none !important; }' });
      await page.evaluate(() => document.fonts.ready);
      await expect(target ? page.locator(target) : page).toHaveScreenshot(`${name}.png`, {
        animations: 'disabled',
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
