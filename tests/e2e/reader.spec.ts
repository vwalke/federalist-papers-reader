import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/papers/1/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('switches reading modes and remembers the preference', async ({ page }) => {
  await page.getByRole('button', { name: 'Reader' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-reading-mode', 'reader');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-reading-mode', 'reader');

  await page.getByRole('button', { name: 'Gazette' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-reading-mode', 'gazette');
});

test('marks a paper read and keeps that state in this browser', async ({ page }) => {
  const control = page.locator('[data-progress-control]');
  await expect(control).toHaveAttribute('aria-pressed', 'false');
  await control.click();
  await expect(control).toHaveAttribute('aria-pressed', 'true');
  await expect(control).toContainText('Marked as read');

  await page.reload();
  await expect(control).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/');
  await expect(page.locator('[data-index-paper="1"]')).toHaveAttribute('data-read', 'true');
  await expect(page.locator('[data-progress-summary]')).toContainText('1 of 85');
});

test('uses one Gazette column on mobile without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/papers/10/');

  const layout = await page.locator('.essay-body').evaluate((element) => ({
    columns: getComputedStyle(element).columnCount,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));

  expect(['auto', '1']).toContain(layout.columns);
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
});

test('uses newspaper columns on a wide screen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/papers/10/');
  await expect.poll(() => page.locator('.essay-body').evaluate((element) => getComputedStyle(element).columnCount)).toBe('3');
});
