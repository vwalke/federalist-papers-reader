import { expect, test } from '@playwright/test';

/* Context-aware prev/next: a guide journey (sessionStorage) outranks the
   home ledger's debate view (localStorage), which outranks the server's
   numeric/shelf order. Each test opens a fresh browser context, so state
   never leaks between flows. */

test.describe('a guide journey', () => {
  test('walks the teachers required list and drops off it cleanly', async ({ page }) => {
    await page.goto('/teachers/');
    await page.locator('ol.teachers-required .curated-entry__link a').first().click();
    await expect(page).toHaveURL(/\/papers\/10\/$/);

    // The nav now walks the list: 10 → 51, under the guide's name.
    const context = page.locator('[data-nav-context]');
    await expect(context).toBeVisible();
    await expect(context).toContainText('From the guide');
    await expect(context).toContainText('The papers, ready for class.');
    const next = page.locator('[data-continue-control]');
    await expect(next).toHaveAttribute('href', '/papers/51/');
    await expect(next).toContainText('Federalist No. 51');
    await expect(next).toContainText('Mark read & continue →');

    // The mark-read-and-continue machinery survives the rewrite.
    await next.click();
    await expect(page).toHaveURL(/\/papers\/51\/$/);
    await expect(page.locator('[data-continue-control]')).toHaveAttribute('href', '/papers/70/');
    await expect(page.locator('[data-continue-control]')).toContainText('Federalist No. 70');
    await expect(page.locator('[data-nav-context]')).toBeVisible();
    await page.goto('/');
    await expect(page.locator('[data-index-paper="10"]')).toHaveAttribute('data-read', 'true');

    // Straying outside the list forgets the journey: numeric order returns…
    await page.goto('/papers/2/');
    await expect(page.locator('[data-nav-context]')).toBeHidden();
    await expect(page.locator('[data-continue-control]')).toHaveAttribute('href', '/papers/3/');
    await expect(page.locator('[data-continue-control]')).toContainText('No. 3');

    // …even back on a paper the list contains.
    await page.goto('/papers/51/');
    await expect(page.locator('[data-nav-context]')).toBeHidden();
    await expect(page.locator('[data-continue-control]')).toHaveAttribute('href', '/papers/52/');
  });

  test('carries the teachers list onto the essay page and ends at the guide', async ({ page }) => {
    await page.goto('/teachers/');
    await page.getByRole('link', { name: 'Read the essay' }).click();
    await expect(page).toHaveURL(/\/antifederalist\/brutus-1\/$/);

    // Brutus I closes the course: prev is No. 78, next returns to the guide.
    await expect(page.locator('[data-nav-context]')).toContainText('The papers, ready for class.');
    const previous = page.locator('.essay-navigation__previous');
    await expect(previous).toHaveAttribute('href', '/papers/78/');
    await expect(previous).toContainText('Federalist No. 78');
    const next = page.locator('[data-continue-control]');
    await expect(next).toHaveAttribute('href', '/teachers/');
    await expect(next).toContainText('Mark read & finish →');
  });

  test('follows the ratification guide in exchange order, challenge before answers', async ({ page }) => {
    await page.goto('/guides/the-ratification-debate/');
    await page.getByRole('link', { name: /Brutus No\. I:/ }).click();
    await expect(page).toHaveURL(/\/antifederalist\/brutus-1\/$/);

    await expect(page.locator('[data-nav-context]')).toHaveText(
      'From the guide: The Ratification Debate'
    );
    const previous = page.locator('.essay-navigation__previous');
    await expect(previous).toHaveAttribute('href', '/guides/the-ratification-debate/');
    await expect(previous).toContainText('← Return');
    const next = page.locator('[data-continue-control]');
    await expect(next).toHaveAttribute('href', '/papers/10/');
    await expect(next).toContainText('Federalist No. 10');

    // The exchange rolls on: after the answer comes the next challenge.
    await next.click();
    await expect(page).toHaveURL(/\/papers\/10\/$/);
    await expect(page.locator('[data-continue-control]')).toHaveAttribute(
      'href',
      '/antifederalist/brutus-2/'
    );
  });
});

test.describe('the debate view', () => {
  test('orders prev/next by publication while the preference holds', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'With the opposition' }).click();
    await expect(page.locator('.index-entry:visible')).toHaveCount(93);

    // Brutus I opens the debate: next is Federalist No. 1, prev the ledger.
    await page.goto('/antifederalist/brutus-1/');
    await expect(page.locator('[data-nav-context]')).toHaveText(
      'The whole debate · in publication order'
    );
    const next = page.locator('[data-continue-control]');
    await expect(next).toHaveAttribute('href', '/papers/1/');
    await expect(next).toContainText('Federalist No. 1');
    await expect(page.locator('.essay-navigation__previous')).toHaveAttribute(
      'href',
      '/#all-papers'
    );

    // Mid-run the essays interleave: No. 2 hands off to Brutus II.
    await page.goto('/papers/2/');
    await expect(page.locator('[data-nav-context]')).toBeVisible();
    await expect(page.locator('[data-continue-control]')).toHaveAttribute(
      'href',
      '/antifederalist/brutus-2/'
    );
    await expect(page.locator('[data-continue-control]')).toContainText('Brutus No. II');

    // Flipping the ledger back restores the numeric order everywhere.
    await page.goto('/');
    await page.getByRole('button', { name: 'The eighty-five' }).click();
    await expect(page.locator('.index-entry:visible')).toHaveCount(85);
    await page.goto('/papers/2/');
    await expect(page.locator('[data-nav-context]')).toBeHidden();
    await expect(page.locator('[data-continue-control]')).toHaveAttribute('href', '/papers/3/');
  });
});

test.describe('a fresh reader', () => {
  test('keeps the server-rendered numeric and shelf order', async ({ page }) => {
    await page.goto('/papers/2/');
    await expect(page.locator('[data-continue-control]')).toHaveAttribute('href', '/papers/3/');
    await expect(page.locator('[data-continue-control]')).toContainText('No. 3');
    await expect(page.locator('[data-nav-context]')).toBeHidden();
    await expect(page.locator('[data-nav-context]')).toBeEmpty();

    await page.goto('/antifederalist/brutus-1/');
    await expect(page.locator('[data-continue-control]')).toHaveAttribute(
      'href',
      '/antifederalist/brutus-2/'
    );
    await expect(page.locator('[data-continue-control]')).toContainText('Brutus No. II');
    await expect(page.locator('[data-nav-context]')).toBeHidden();
  });
});
