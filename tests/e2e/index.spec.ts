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

test('features the opposition in the header nav', async ({ page }) => {
  await page.goto('/');
  const navLink = page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('link', { name: /the opposition/i });
  await expect(navLink).toBeVisible();
  await navLink.click();
  await expect(page).toHaveURL(/\/antifederalist\/$/);
});

test('interleaves the opposition on demand and remembers the choice', async ({ page }) => {
  await page.goto('/');

  // Untouched, the ledger is exactly the eighty-five.
  await expect(page.locator('.index-entry:visible')).toHaveCount(85);
  await expect(page.locator('#index-heading')).toHaveText('All eighty-five papers');
  await expect(page.locator('[data-index-count]')).toHaveText('Showing all 85 papers');
  await expect(page.locator('[data-progress-summary]')).toHaveText('0 of 85 read in this browser');
  await expect(page.getByLabel('Sort by')).toBeVisible();

  await page.getByRole('button', { name: 'With the opposition' }).click();
  await expect(page.locator('.index-entry:visible')).toHaveCount(93);
  await expect(page.locator('#index-heading')).toHaveText('Both sides, in order');
  await expect(page.locator('[data-index-kicker]')).toHaveText('The whole debate');
  await expect(page.locator('[data-index-count]')).toHaveText('Showing all 93 papers and essays');
  await expect(page.locator('[data-progress-summary]')).toHaveText('0 of 93 read in this browser');

  // Brutus I (Oct 18, 1787) opens the debate, ahead of Federalist No. 1 (Oct 27).
  const firstRow = page.locator('.index-entry:visible').first();
  await expect(firstRow).toHaveAttribute('data-index-essay', '101');
  await expect(page.locator('.index-entry:visible').nth(1)).toHaveAttribute('data-index-paper', '1');

  // Order is the debate's chronology; the sort select and its note step aside.
  await expect(page.getByLabel('Sort by')).toBeHidden();
  await expect(page.locator('[data-sort-note]')).toBeHidden();

  // Search runs across both collections, under the view's own label.
  const search = page.getByRole('searchbox', { name: 'Search the collection' });
  await search.fill('standing armies');
  await expect(page.locator('[data-index-essay="110"]')).toBeVisible();
  await expect(page.locator('[data-index-count]')).toContainText('papers and essays');

  // The synthetic progress id is bookkeeping: "101" is not a match for Brutus I.
  await search.fill('101');
  await expect(page.locator('[data-index-essay="101"]')).toBeHidden();
  await expect(page.locator('[data-index-empty]')).toContainText('Nothing matches that search');
  await search.fill('');

  // An essay row's toggle carries the shared read state.
  const brutusOne = page.locator('[data-index-essay="101"]');
  await brutusOne.locator('[data-index-status]').click();
  await expect(brutusOne).toHaveAttribute('data-read', 'true');
  await expect(page.locator('[data-progress-summary]')).toHaveText('1 of 93 read in this browser');

  // The choice survives a reload.
  await page.reload();
  await expect(page.locator('.index-entry:visible')).toHaveCount(93);
  await expect(page.locator('.index-entry:visible').first()).toHaveAttribute('data-index-essay', '101');
  await expect(page.getByLabel('Sort by')).toBeHidden();

  // And the eighty-five return untouched: heading, sort field, and copy restored.
  await page.getByRole('button', { name: 'The eighty-five' }).click();
  await expect(page.locator('.index-entry:visible')).toHaveCount(85);
  await expect(page.locator('#index-heading')).toHaveText('All eighty-five papers');
  await expect(page.locator('[data-index-kicker]')).toHaveText('The complete collection');
  await expect(page.locator('[data-index-count]')).toHaveText('Showing all 85 papers');
  await expect(page.locator('[data-progress-summary]')).toHaveText('0 of 85 read in this browser');
  await expect(page.getByLabel('Sort by')).toBeVisible();
  await expect(page.locator('[data-sort-note]')).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search all papers' })).toBeVisible();
  await expect(page.locator('[data-index-empty]')).toContainText('No papers match that search');
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
