import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const path of ['/', '/papers/1/', '/about/', '/subscribe/']) {
  test(`${path} has no automatically detectable accessibility violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}

test('core reading and navigation remain when JavaScript is disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/papers/1/');
  await expect(page.getByText('AFTER an unequivocal experience')).toBeVisible();
  await expect(page.getByRole('link', { name: /No. 2:/ })).toBeVisible();

  await page.goto('/');
  await expect(page.locator('[data-index-paper]')).toHaveCount(85);
  await context.close();
});

test('the missing-page route is helpful', async ({ page }) => {
  const response = await page.goto('/this-paper-does-not-exist/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: /page has gone missing/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /return to all papers/i })).toBeVisible();
});
