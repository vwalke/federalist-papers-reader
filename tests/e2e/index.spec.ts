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
  const soloOrder = await page.$$eval('.index-entry:not([hidden])', (rows) =>
    rows.map((row) => row.getAttribute('data-index-paper'))
  );

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

  // The essays slot into the same chronology: the papers keep their exact order.
  const combinedOrder = await page.$$eval('.index-entry:not([hidden])', (rows) =>
    rows.map((row) => row.getAttribute('data-index-paper'))
  );
  expect(combinedOrder).toHaveLength(93);
  expect(combinedOrder.filter((number) => number !== null)).toEqual(soloOrder);

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
  await expect(page.locator('#index-heading')).toHaveText('Both sides, in order');

  // And the eighty-five return untouched: heading and copy restored.
  await page.getByRole('button', { name: 'The eighty-five' }).click();
  await expect(page.locator('.index-entry:visible')).toHaveCount(85);
  await expect(page.locator('#index-heading')).toHaveText('All eighty-five papers');
  await expect(page.locator('[data-index-kicker]')).toHaveText('The complete collection');
  await expect(page.locator('[data-index-count]')).toHaveText('Showing all 85 papers');
  await expect(page.locator('[data-progress-summary]')).toHaveText('0 of 85 read in this browser');
  await expect(page.getByRole('searchbox', { name: 'Search all papers' })).toBeVisible();
  await expect(page.locator('[data-index-empty]')).toContainText('No papers match that search');
});

test('runs chronologically with no sort control and announces the result count', async ({ page }) => {
  await page.goto('/');

  // There is one order — publication — so the sort select is gone entirely.
  await expect(page.locator('select[name="sort"]')).toHaveCount(0);
  await expect(page.locator('[data-sort-note]')).toBeVisible();
  await expect(page.locator('[data-sort-note]')).toContainText('the order they reached readers');
  await expect(page.locator('[data-sort-note]')).toContainText('No. 29 appeared after Nos. 30–36');

  // Publication order: No. 1 first, No. 29 after Nos. 30–36 (its true date).
  await expect(page.locator('[data-index-paper]:visible').first()).toHaveAttribute('data-index-paper', '1');
  await expect(page.locator('[data-index-paper]:visible').nth(28)).toHaveAttribute('data-index-paper', '30');
  await expect(page.locator('[data-index-paper]:visible').nth(35)).toHaveAttribute('data-index-paper', '29');
  // Nos. 78–85 close the run at their bound-edition date.
  await expect(page.locator('[data-index-paper]:visible').last()).toHaveAttribute('data-index-paper', '85');
  await expect(page.locator('[data-index-count]')).toHaveAttribute('aria-live', 'polite');
});
