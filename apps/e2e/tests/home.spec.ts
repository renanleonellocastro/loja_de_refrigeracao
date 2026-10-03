import { expect, test } from '@playwright/test';
import { expectAccessible } from '../support/a11y.js';

test.describe('RF-36 página inicial', () => {
  test('mostra a marca sem rolagem horizontal @a11y', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Refrigeração Castro');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await expectAccessible(page);
  });
});
