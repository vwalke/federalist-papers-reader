import { expect, test } from '@playwright/test';

test('affected site routes retain their primary next step without X referrals', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.gazette-masthead')).toBeVisible();
  await expect(page.locator('[data-index-paper]')).toHaveCount(85);
  await expect(page.locator('a[href*="x.com"], a[href*="twitter.com"]')).toHaveCount(0);

  await page.goto('/about/');
  await expect(page.getByRole('link', { name: 'publius@federalistreader.org' })).toHaveAttribute(
    'href',
    'mailto:publius@federalistreader.org',
  );
  await expect(page.getByText('This is a production of')).toBeVisible();
  await expect(page.locator('a[href*="x.com"], a[href*="twitter.com"]')).toHaveCount(0);

  await page.goto('/subscribe/confirmed/');
  await expect(page.getByRole('link', { name: 'Read Federalist No. 1' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'browse the full collection' })).toBeVisible();
  await expect(page.locator('a[href*="x.com"], a[href*="twitter.com"]')).toHaveCount(0);
});
