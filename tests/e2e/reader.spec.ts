import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('publius:test-initialized')) {
      localStorage.clear();
      sessionStorage.setItem('publius:test-initialized', 'true');
    }
  });
  await page.goto('/papers/1/');
});

test('switches reading modes and remembers the preference', async ({ page }) => {
  const styleControl = page.getByRole('group', { name: 'Reading style' });
  await expect(styleControl.getByRole('button')).toHaveCount(2);
  await expect(styleControl.getByRole('button', { name: 'Gazette' })).toHaveAttribute('aria-pressed', 'true');

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
  await expect(control).toHaveAttribute('aria-label', 'Mark as read');
  await control.click();
  await expect(control).toHaveAttribute('aria-pressed', 'true');
  await expect(control).toHaveAttribute('aria-label', 'Marked as read');
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
    ),
    progressWidth: document.querySelector('.progress-control')?.getBoundingClientRect().width ?? Infinity,
    bookmarkBefore: getComputedStyle(
      document.querySelector('.progress-control__mark') as Element,
      '::before'
    ).content,
    bookmarkAfter: getComputedStyle(
      document.querySelector('.progress-control__mark') as Element,
      '::after'
    ).content
  }));

  expect(['auto', '1']).toContain(layout.columns);
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.mastheadWidth).toBeLessThanOrEqual(layout.sheetWidth);
  expect(layout.controlHeights.every((height) => height >= 44)).toBe(true);
  expect(layout.progressWidth).toBeLessThanOrEqual(60);
  expect(layout.bookmarkBefore).not.toBe('none');
  expect(layout.bookmarkAfter).not.toBe('none');
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
      sheetWidth: document.querySelector('.paper-sheet')?.getBoundingClientRect().width ?? 0,
      modeX: document.querySelector('.reading-toolbar__modes')?.getBoundingClientRect().x ?? Infinity,
      progressX: document.querySelector('.progress-control')?.getBoundingClientRect().x ?? 0,
      titleText: title?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    };
  });

  expect(metrics.columnCount).toBe('3');
  expect(metrics.titleFontFamily).toContain('Libre Caslon Display');
  expect(metrics.bodyLineHeight / metrics.bodyFontSize).toBeLessThanOrEqual(1.45);
  expect(metrics.headingHeight).toBeLessThan(240);
  expect(metrics.mastheadVisible).toBe(true);
  expect(metrics.mastheadWidth).toBeLessThanOrEqual(metrics.sheetWidth);
  expect(metrics.modeX).toBeLessThan(metrics.progressX);
  expect(metrics.titleText).toContain('THE FEDERALIST. No. X.');
});

test('keeps the reading companion balanced on desktop and stacked on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/papers/2/');

  const desktop = await page.locator('.commentary__details').evaluate((details) => {
    const sections = [...details.querySelectorAll(':scope > section')];
    const rects = sections.map((section) => section.getBoundingClientRect());
    return {
      count: sections.length,
      widths: rects.map(({ width }) => width),
      yPositions: rects.map(({ y }) => y),
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });

  expect(desktop.count).toBe(3);
  expect(Math.min(...desktop.widths)).toBeGreaterThan(220);
  expect(Math.max(...desktop.widths) / Math.min(...desktop.widths)).toBeLessThan(1.5);
  expect(Math.max(...desktop.yPositions) - Math.min(...desktop.yPositions)).toBeLessThan(2);
  expect(desktop.overflow).toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/papers/2/');

  const mobile = await page.locator('.commentary__details').evaluate((details) => {
    const rects = [...details.querySelectorAll(':scope > section')].map((section) =>
      section.getBoundingClientRect()
    );
    return {
      xPositions: rects.map(({ x }) => x),
      yPositions: rects.map(({ y }) => y),
      widths: rects.map(({ width }) => width),
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });

  expect(Math.max(...mobile.xPositions) - Math.min(...mobile.xPositions)).toBeLessThan(2);
  expect(mobile.yPositions[0]).toBeLessThan(mobile.yPositions[1]);
  expect(mobile.yPositions[1]).toBeLessThan(mobile.yPositions[2]);
  expect(Math.min(...mobile.widths)).toBeGreaterThan(300);
  expect(mobile.overflow).toBeLessThanOrEqual(0);
});

test('renders varied archival wear without clipping the sheet', async ({ page }) => {
  await page.goto('/papers/1/');

  const paperOne = await page.locator('.paper-wear').evaluate((wear) => ({
    tagName: wear.tagName.toLowerCase(),
    display: getComputedStyle(wear).display,
    foldSignature: wear.getAttribute('data-fold-signature'),
    foldCount: wear.querySelectorAll('[data-fold]').length,
    clipPath: getComputedStyle(document.querySelector('.paper-page') as Element).clipPath,
    hasLegacyNicks: Boolean(document.querySelector('.paper-wear__nick'))
  }));

  expect(paperOne.tagName).toBe('svg');
  expect(paperOne.display).not.toBe('none');
  expect(paperOne.foldCount).toBe(3);
  expect(paperOne.clipPath).toBe('none');
  expect(paperOne.hasLegacyNicks).toBe(false);

  await page.goto('/papers/2/');
  const paperTwoSignature = await page.locator('.paper-wear').getAttribute('data-fold-signature');
  expect(paperTwoSignature).not.toBe(paperOne.foldSignature);

  await page.getByRole('button', { name: 'Reader' }).click();
  await expect(page.locator('.paper-wear')).toBeHidden();
});
