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

async function titleMetrics(page: import('@playwright/test').Page) {
  return page.locator('.essay-heading__title').evaluate((title) => {
    const range = document.createRange();
    range.selectNodeContents(title);
    const lineTops = new Set(
      [...range.getClientRects()]
        .filter(({ width, height }) => width > 0 && height > 0)
        .map(({ top }) => Math.round(top))
    );
    const toolbar = document.querySelector('.reading-toolbar') as Element;
    const flow = document.querySelector('.essay-flow') as Element;
    const titleStyle = getComputedStyle(title);

    return {
      lines: lineTops.size,
      titleFontFamily: titleStyle.fontFamily,
      titleText: title.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      contentGap: title.getBoundingClientRect().top - toolbar.getBoundingClientRect().bottom,
      flowPaddingTop: Number.parseFloat(getComputedStyle(flow).paddingTop),
      titleOverflow: title.scrollWidth - title.clientWidth,
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });
}

test('switches reading modes and remembers the preference', async ({ page }) => {
  const styleControl = page.getByRole('group', { name: 'Reading style' });
  const periodWord = page.locator('.essay-body .period-spelling').first();
  const titleWord = page.locator('.essay-heading__title .period-spelling');
  const bodyFont = () =>
    page.locator('.essay-body').evaluate((body) => getComputedStyle(body).fontFamily);
  await expect(styleControl.getByRole('button')).toHaveCount(2);
  await expect(styleControl.getByRole('button', { name: 'Gazette' })).toHaveAttribute('aria-pressed', 'true');
  await expect(periodWord).toHaveText('fœderal');
  await expect(periodWord).toHaveAttribute('aria-label', 'federal');
  await expect(titleWord).toHaveText('FŒDERALIST');
  expect(await bodyFont()).toContain('IM FELL DW Pica');

  await page.getByRole('button', { name: 'Reader' }).click();
  await expect(periodWord).toHaveText('federal');
  await expect(titleWord).toHaveText('FEDERALIST');
  await expect(page.locator('html')).toHaveAttribute('data-reading-mode', 'reader');
  expect(await bodyFont()).not.toContain('IM FELL DW Pica');
  expect(await bodyFont()).toContain('Libre Caslon Text');
  await page.reload();
  await expect(periodWord).toHaveText('federal');
  await expect(page.locator('html')).toHaveAttribute('data-reading-mode', 'reader');

  await page.getByRole('button', { name: 'Gazette' }).click();
  await expect(periodWord).toHaveText('fœderal');
  await expect(page.locator('html')).toHaveAttribute('data-reading-mode', 'gazette');
});

test('marks a paper read and keeps that state in this browser', async ({ page }) => {
  const control = page.locator('.reading-toolbar [data-progress-control]');
  const continueControl = page.locator('[data-continue-control]');
  await expect(control).toHaveAttribute('aria-pressed', 'false');
  await expect(control).toHaveAttribute('aria-label', 'Mark as read');
  await expect(continueControl).toContainText('Mark read & continue →');
  await control.click();
  await expect(control).toHaveAttribute('aria-pressed', 'true');
  await expect(control).toHaveAttribute('aria-label', 'Marked as read');
  await expect(control).toContainText('Marked as read');

  // The Next cell drops the mark-read half once the paper is recorded.
  await expect(continueControl).toContainText('Next →');
  await control.click();
  await expect(continueControl).toContainText('Mark read & continue →');
  await control.click();

  await page.reload();
  await expect(control).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/');
  await expect(page.locator('[data-index-paper="1"]')).toHaveAttribute('data-read', 'true');
  await expect(page.locator('[data-progress-summary]')).toContainText('1 of 85');
});

test('marks read and moves on from the Next cell', async ({ page }) => {
  const continueControl = page.locator('[data-continue-control]');
  await expect(continueControl).toContainText('Mark read & continue →');
  await continueControl.click();

  await expect(page).toHaveURL(/\/papers\/2\/$/);
  const control = page.locator('.reading-toolbar [data-progress-control]');
  await expect(control).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-continue-control]')).toContainText('Mark read & continue →');

  // Once the paper is recorded from the toolbar, the cell is plain navigation.
  await control.click();
  await expect(page.locator('[data-continue-control]')).toContainText('Next →');
  await page.locator('[data-continue-control]').click();
  await expect(page).toHaveURL(/\/papers\/3\/$/);

  await page.goto('/');
  await expect(page.locator('[data-index-paper="1"]')).toHaveAttribute('data-read', 'true');
  await expect(page.locator('[data-index-paper="2"]')).toHaveAttribute('data-read', 'true');
  await expect(page.locator('[data-progress-summary]')).toContainText('2 of 85');
});

test('uses one Gazette column on mobile without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/papers/10/');

  const layout = await page.locator('.essay-flow').evaluate((element) => ({
    columns: getComputedStyle(element).columnCount,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    mastheadWidth: document.querySelector('.gazette-masthead__art')?.getBoundingClientRect().width ?? 0,
    sheetWidth: document.querySelector('.paper-sheet')?.getBoundingClientRect().width ?? 0,
    controlHeights: [...document.querySelectorAll('.reading-toolbar button')].map(
      (control) => control.getBoundingClientRect().height
    ),
    progressWidth: document.querySelector('.progress-control')?.getBoundingClientRect().width ?? Infinity,
    toolbarDisplay: getComputedStyle(document.querySelector('.reading-toolbar') as Element).display,
    modesRect: document.querySelector('.reading-toolbar__modes')?.getBoundingClientRect().toJSON(),
    progressRect: document.querySelector('.progress-control')?.getBoundingClientRect().toJSON(),
    scaleRect: document.querySelector('.reading-toolbar__scale')?.getBoundingClientRect().toJSON(),
    checkText: document.querySelector('.progress-control__mark')?.textContent
  }));

  expect(['auto', '1']).toContain(layout.columns);
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.mastheadWidth).toBeLessThanOrEqual(layout.sheetWidth);
  expect(layout.controlHeights.every((height) => height >= 44)).toBe(true);
  expect(layout.progressWidth).toBeLessThanOrEqual(60);
  expect(layout.toolbarDisplay).toBe('grid');
  expect(layout.checkText).toBe('✓');
  expect(Math.abs((layout.modesRect?.top ?? 0) - (layout.progressRect?.top ?? 0))).toBeLessThanOrEqual(2);
  expect(layout.scaleRect?.top ?? 0).toBeGreaterThan(layout.modesRect?.bottom ?? Infinity);

  await page.setViewportSize({ width: 500, height: 844 });
  await page.goto('/papers/10/');
  const mediumToolbar = await page.locator('.reading-toolbar').evaluate((toolbar) => ({
    display: getComputedStyle(toolbar).display,
    modesTop: toolbar.querySelector('.reading-toolbar__modes')?.getBoundingClientRect().top,
    progressTop: toolbar.querySelector('.progress-control')?.getBoundingClientRect().top,
    scaleTop: toolbar.querySelector('.reading-toolbar__scale')?.getBoundingClientRect().top,
    overflow: document.documentElement.scrollWidth - window.innerWidth
  }));
  expect(mediumToolbar.display).toBe('flex');
  expect(Math.abs((mediumToolbar.modesTop ?? 0) - (mediumToolbar.progressTop ?? 0))).toBeLessThanOrEqual(2);
  expect(Math.abs((mediumToolbar.scaleTop ?? 0) - (mediumToolbar.progressTop ?? 0))).toBeLessThanOrEqual(2);
  expect(mediumToolbar.overflow).toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/papers/85/');
  const narrowTitle = await titleMetrics(page);
  expect(narrowTitle.lines).toBe(1);
  expect(narrowTitle.titleText).toBe('THE FŒDERALIST. No. LXXXV.');
  expect(narrowTitle.titleFontFamily).toContain('IM FELL English');
  expect(narrowTitle.flowPaddingTop).toBeCloseTo(12, 0);
  expect(narrowTitle.contentGap).toBeGreaterThanOrEqual(10);
  expect(narrowTitle.overflow).toBeLessThanOrEqual(0);
});

test('places anonymous top matter in the Gazette first column', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/papers/10/');

  const metrics = await page.locator('.essay-flow').evaluate((flow) => {
    const flowStyle = getComputedStyle(flow);
    const heading = flow.querySelector('.essay-heading') as Element;
    const title = flow.querySelector('.essay-heading__title') as Element;
    const paragraphs = [...flow.querySelectorAll('.essay-body > p')];
    const headingRect = heading.getBoundingClientRect();
    const paragraphRects = paragraphs.map((paragraph) => paragraph.getBoundingClientRect());
    const rightColumnTop = Math.min(
      ...paragraphRects
        .filter(({ x }) => x > headingRect.right + 10)
        .map(({ y }) => y)
    );
    const masthead = document.querySelector('.gazette-masthead__art');

    return {
      columnCount: flowStyle.columnCount,
      headingX: headingRect.x,
      headingY: headingRect.y,
      headingWidth: headingRect.width,
      flowWidth: flow.getBoundingClientRect().width,
      rightColumnTop,
      titleFontFamily: getComputedStyle(title).fontFamily,
      titleText: title.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      topAuthorVisible: Boolean(flow.querySelector('.essay-heading__author')),
      publicationVisible: Boolean(flow.querySelector('.essay-heading__publication')),
      mastheadVisible: masthead ? getComputedStyle(masthead).display !== 'none' : false,
      mastheadWidth: masthead?.getBoundingClientRect().width ?? Infinity,
      sheetWidth: document.querySelector('.paper-sheet')?.getBoundingClientRect().width ?? 0,
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });

  expect(metrics.columnCount).toBe('3');
  expect(metrics.headingWidth).toBeLessThan(metrics.flowWidth / 2);
  expect(Math.abs(metrics.rightColumnTop - metrics.headingY)).toBeLessThan(40);
  expect(metrics.titleFontFamily).toContain('IM FELL English');
  expect(metrics.titleText).toContain('THE FŒDERALIST. No. X.');
  expect(metrics.topAuthorVisible).toBe(false);
  expect(metrics.publicationVisible).toBe(false);
  expect(metrics.mastheadVisible).toBe(true);
  expect(metrics.mastheadWidth).toBeLessThanOrEqual(metrics.sheetWidth);
  expect(metrics.overflow).toBeLessThanOrEqual(0);

  await page.goto('/papers/85/');
  const desktopLongestTitle = await titleMetrics(page);
  expect(desktopLongestTitle.lines).toBe(1);
  expect(desktopLongestTitle.titleOverflow).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto('/papers/85/');
  const zoomEquivalent = await titleMetrics(page);
  expect(zoomEquivalent.lines).toBe(1);
  expect(zoomEquivalent.titleOverflow).toBeLessThanOrEqual(1);
  expect(zoomEquivalent.overflow).toBeLessThanOrEqual(0);

  await page.getByRole('button', { name: 'Reader' }).click();
  const readerTitle = await titleMetrics(page);
  expect(readerTitle.lines).toBe(1);
  expect(readerTitle.titleFontFamily).toContain('Libre Caslon Display');
  expect(readerTitle.titleOverflow).toBeLessThanOrEqual(1);
  expect(readerTitle.overflow).toBeLessThanOrEqual(0);
});

test('keeps the companion introduction coherent and its details responsive', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/papers/2/');

  const desktop = await page.locator('.commentary').evaluate((commentary) => {
    const heading = commentary.querySelector('.commentary__heading') as Element;
    const ornament = heading.querySelector('[aria-hidden="true"]') as Element;
    const lead = commentary.querySelector('.commentary__lead') as Element;
    const details = commentary.querySelector('.commentary__details') as Element;
    const attribution = commentary.querySelector('.commentary__attribution') as Element;
    const question = commentary.querySelector('.commentary__question') as Element;
    const sectionRects = [...details.querySelectorAll(':scope > section')].map((section) =>
      section.getBoundingClientRect()
    );
    const headingRect = heading.getBoundingClientRect();
    const ornamentRect = ornament.getBoundingClientRect();
    const leadRect = lead.getBoundingClientRect();
    const attributionRect = attribution.getBoundingClientRect();
    const questionStyle = getComputedStyle(question);

    return {
      ornamentText: ornament.textContent?.trim() ?? '',
      headingLabel: heading.querySelector('span:last-child')?.textContent?.trim() ?? '',
      headingY: headingRect.y,
      ornamentY: ornamentRect.y,
      leadY: leadRect.y,
      leadX: leadRect.x,
      companionX: commentary.getBoundingClientRect().x,
      sectionWidths: sectionRects.map(({ width }) => width),
      sectionYPositions: sectionRects.map(({ y }) => y),
      attributionY: attributionRect.y,
      detailsBottom: Math.max(...sectionRects.map(({ bottom }) => bottom)),
      questionBorderInlineStart: questionStyle.borderInlineStartWidth,
      questionPaddingInlineStart: questionStyle.paddingInlineStart,
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });

  expect(desktop.ornamentText).toBe('✦');
  expect(desktop.headingLabel).toBe('Reading companion');
  expect(Math.abs(desktop.ornamentY - desktop.headingY)).toBeLessThan(6);
  expect(desktop.leadY).toBeGreaterThan(desktop.headingY);
  expect(Math.abs(desktop.leadX - desktop.companionX)).toBeLessThan(2);
  expect(Math.min(...desktop.sectionWidths)).toBeGreaterThan(220);
  expect(Math.max(...desktop.sectionWidths) / Math.min(...desktop.sectionWidths)).toBeLessThan(1.5);
  expect(Math.max(...desktop.sectionYPositions) - Math.min(...desktop.sectionYPositions)).toBeLessThan(2);
  expect(desktop.attributionY).toBeGreaterThan(desktop.detailsBottom);
  expect(desktop.questionBorderInlineStart).toBe('0px');
  expect(desktop.questionPaddingInlineStart).toBe('0px');
  expect(desktop.overflow).toBeLessThanOrEqual(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/papers/2/');

  const mobile = await page.locator('.commentary').evaluate((commentary) => {
    const detailRects = [...commentary.querySelectorAll('.commentary__details > section')].map(
      (section) => section.getBoundingClientRect()
    );
    const heading = commentary.querySelector('.commentary__heading') as Element;
    const lead = commentary.querySelector('.commentary__lead') as Element;
    const attribution = commentary.querySelector('.commentary__attribution') as Element;

    return {
      headingY: heading.getBoundingClientRect().y,
      leadY: lead.getBoundingClientRect().y,
      detailXPositions: detailRects.map(({ x }) => x),
      detailYPositions: detailRects.map(({ y }) => y),
      detailWidths: detailRects.map(({ width }) => width),
      attributionY: attribution.getBoundingClientRect().y,
      detailsBottom: Math.max(...detailRects.map(({ bottom }) => bottom)),
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });

  expect(mobile.headingY).toBeLessThan(mobile.leadY);
  expect(Math.max(...mobile.detailXPositions) - Math.min(...mobile.detailXPositions)).toBeLessThan(2);
  expect(mobile.detailYPositions[0]).toBeLessThan(mobile.detailYPositions[1]);
  expect(mobile.detailYPositions[1]).toBeLessThan(mobile.detailYPositions[2]);
  expect(Math.min(...mobile.detailWidths)).toBeGreaterThan(300);
  expect(mobile.attributionY).toBeGreaterThan(mobile.detailsBottom);
  expect(mobile.overflow).toBeLessThanOrEqual(0);
});

test('scales the reading text from the toolbar slider and remembers it', async ({ page }) => {
  await page.goto('/papers/3/');

  const slider = page.getByRole('slider', { name: 'Text size' });
  const paragraph = page.locator('.essay-body p').first();
  const sizeOf = () =>
    paragraph.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));

  await expect(slider).toHaveValue('0');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Standard');
  const standard = await sizeOf();

  await slider.fill('4');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Largest');
  const largest = await sizeOf();
  expect(largest / standard).toBeGreaterThan(1.5);
  expect(largest / standard).toBeLessThan(1.6);

  await page.reload();
  await expect(page.getByRole('slider', { name: 'Text size' })).toHaveValue('4');
  expect(await sizeOf()).toBeCloseTo(largest, 1);
});

test('renders varied archival wear without clipping the sheet', async ({ page }) => {
  await page.goto('/papers/1/');

  const paperOne = await page.locator('.paper-wear').evaluate((wear) => ({
    display: getComputedStyle(wear).display,
    signature: wear.getAttribute('data-wear-signature'),
    edgeCount: wear.querySelectorAll('.paper-wear__edge').length,
    edgeMask: getComputedStyle(wear.querySelector('.paper-wear__edge--top') as Element)
      .maskImage,
    biteCount: wear.querySelectorAll('.paper-wear__bite').length,
    clipPath: getComputedStyle(document.querySelector('.paper-page') as Element).clipPath,
    hasLegacyGrime: Boolean(
      document.querySelector('.paper-wear__stains, .paper-wear__abrasions, [data-fold]')
    )
  }));

  expect(paperOne.display).not.toBe('none');
  expect(paperOne.edgeCount).toBe(4);
  expect(paperOne.edgeMask).toContain('data:image/svg+xml');
  expect(paperOne.biteCount).toBeGreaterThanOrEqual(4);
  expect(paperOne.clipPath).toBe('none');
  expect(paperOne.hasLegacyGrime).toBe(false);

  await page.goto('/papers/2/');
  const paperTwoSignature = await page.locator('.paper-wear').getAttribute('data-wear-signature');
  expect(paperTwoSignature).not.toBe(paperOne.signature);

  await page.getByRole('button', { name: 'Reader' }).click();
  await expect(page.locator('.paper-wear')).toBeHidden();
});
