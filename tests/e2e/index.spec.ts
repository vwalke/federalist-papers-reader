import { expect, test } from '@playwright/test';

test('offers all papers and filters them by message, author, or number', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-index-paper]')).toHaveCount(85);

  const search = page.getByRole('searchbox', { name: 'Search all papers' });
  await search.fill('checks and balances');
  await expect(page.locator('[data-index-paper]:visible')).toHaveCount(1);
  await expect(page.locator('[data-index-paper]:visible')).toHaveAttribute('data-index-paper', '51');

  await search.fill('John Jay');
  await expect(page.locator('[data-index-paper]:visible').first()).toContainText('John Jay');

  await search.fill('85');
  await expect(page.locator('[data-index-paper]:visible')).toHaveCount(1);
});

test('sorts the ledger and announces the result count', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Sort by').locator('option')).toHaveText([
    'Paper order',
    'Author',
    'First publication'
  ]);
  await expect(page.locator('[data-sort-note]')).toContainText('No. 29 appeared after Nos. 30–36');
  await page.getByLabel('Sort by').selectOption('date');
  await expect(page.locator('[data-index-paper]:visible').first()).toHaveAttribute('data-index-paper', '1');
  await expect(page.locator('[data-index-paper]:visible').nth(28)).toHaveAttribute('data-index-paper', '30');
  await expect(page.locator('[data-index-paper]:visible').nth(35)).toHaveAttribute('data-index-paper', '29');
  await expect(page.locator('[data-index-count]')).toHaveAttribute('aria-live', 'polite');
});
