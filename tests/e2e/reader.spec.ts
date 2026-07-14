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
    viewportWidth: window.innerWidth,
    mastheadWidth: document.querySelector('.gazette-masthead__art')?.getBoundingClientRect().width ?? 0,
    sheetWidth: document.querySelector('.paper-sheet')?.getBoundingClientRect().width ?? 0,
    controlHeights: [...document.querySelectorAll('.reading-toolbar button')].map(
      (control) => control.getBoundingClientRect().height
    )
  }));

  expect(['auto', '1']).toContain(layout.columns);
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.mastheadWidth).toBeLessThanOrEqual(layout.sheetWidth);
  expect(layout.controlHeights.every((height) => height >= 44)).toBe(true);
});

test('matches the compact newspaper composition on a wide screen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/papers/10/');

  const metrics = await page.locator('.essay-body').evaluate((element) => {
    const bodyStyle = getComputedStyle(element);
    const title = document.querySelector('.essay-heading__title');
    const masthead = document.querySelector('.gazette-masthead__art');

    return {
      columnCount: bodyStyle.columnCount,
      bodyFontSize: Number.parseFloat(bodyStyle.fontSize),
      bodyLineHeight: Number.parseFloat(bodyStyle.lineHeight),
      titleFontFamily: title ? getComputedStyle(title).fontFamily : '',
      headingHeight: document.querySelector('.essay-heading')?.getBoundingClientRect().height ?? Infinity,
      mastheadVisible: masthead ? getComputedStyle(masthead).display !== 'none' : false,
      mastheadWidth: masthead?.getBoundingClientRect().width ?? Infinity,
      sheetWidth: document.querySelector('.paper-sheet')?.getBoundingClientRect().width ?? 0
    };
  });

  expect(metrics.columnCount).toBe('3');
  expect(metrics.titleFontFamily).toContain('Libre Caslon Display');
  expect(metrics.bodyLineHeight / metrics.bodyFontSize).toBeLessThanOrEqual(1.45);
  expect(metrics.headingHeight).toBeLessThan(240);
  expect(metrics.mastheadVisible).toBe(true);
  expect(metrics.mastheadWidth).toBeLessThanOrEqual(metrics.sheetWidth);
});
