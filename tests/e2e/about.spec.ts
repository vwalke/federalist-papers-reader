import { expect, test } from '@playwright/test';

test('composes the About story as an editorial grid on wide screens', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/about/');

  const layout = await page.locator('.about-page').evaluate((about) => {
    const box = (selector: string) => {
      const element = about.querySelector(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };

    const columnBoxes = [...about.querySelectorAll('.about-closing__column')].map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    });

    return {
      originDisplay: getComputedStyle(about.querySelector('.about-origin') as Element).display,
      familyDisplay: getComputedStyle(about.querySelector('.about-family') as Element).display,
      closingDisplay: getComputedStyle(about.querySelector('.about-closing') as Element).display,
      columnRuleWidth: getComputedStyle(
        about.querySelector('.about-closing__column + .about-closing__column') as Element,
      ).borderInlineStartWidth,
      copy: box('.about-origin__copy'),
      portrait: box('.about-portrait'),
      callout: box('.about-callout'),
      familyHeading: box('.about-family__head'),
      familyCopy: box('.about-family__copy'),
      documentsDisplay: getComputedStyle(
        about.querySelector('.about-documents') as Element,
      ).display,
      documentsHead: box('.about-documents__head'),
      documentsFigure: box('.about-documents__figure'),
      documentsImage: box('.about-documents__image'),
      documentsCaption: box('.about-documents__caption'),
      documentsCopy: box('.about-documents__copy'),
      colophon: box('.about-colophon'),
      colophonTextAlign: getComputedStyle(about.querySelector('.about-colophon') as Element).textAlign,
      columnBoxes,
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });

  expect(layout.originDisplay).toBe('grid');
  expect(layout.familyDisplay).toBe('grid');
  expect(layout.closingDisplay).toBe('grid');
  expect(layout.columnRuleWidth).toBe('1px');
  expect(layout.copy.x).toBeLessThan(layout.portrait.x);
  expect(Math.abs(layout.copy.x - layout.callout.x)).toBeLessThan(2);
  expect(layout.callout.y).toBeGreaterThan(layout.copy.y);
  expect(layout.familyHeading.x).toBeLessThan(layout.familyCopy.x);
  expect(layout.documentsDisplay).toBe('grid');
  expect(layout.documentsFigure.x).toBeLessThan(layout.documentsHead.x);
  expect(layout.documentsFigure.x).toBeLessThan(layout.documentsCopy.x);
  expect(Math.abs(layout.documentsHead.x - layout.documentsCopy.x)).toBeLessThan(2);
  expect(layout.documentsCopy.y).toBeGreaterThan(layout.documentsHead.y);
  expect(layout.documentsCaption.y).toBeGreaterThan(
    layout.documentsImage.y + layout.documentsImage.height,
  );
  expect(layout.documentsCaption.y + layout.documentsCaption.height).toBeLessThanOrEqual(
    layout.documentsFigure.y + layout.documentsFigure.height + 1,
  );
  expect(layout.columnBoxes).toHaveLength(2);
  expect(layout.columnBoxes[0].x).toBeLessThan(layout.columnBoxes[1].x);
  expect(Math.abs(layout.columnBoxes[0].y - layout.columnBoxes[1].y)).toBeLessThan(2);
  expect(layout.colophon.y).toBeGreaterThan(
    Math.max(...layout.columnBoxes.map(({ y, height }) => y + height)),
  );
  expect(layout.colophonTextAlign).toBe('center');
  expect(layout.overflow).toBeLessThanOrEqual(0);
});

test('keeps the About story linear and roomy on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/about/');

  const layout = await page.locator('.about-page').evaluate((about) => {
    const selectors = [
      '.about-origin__copy',
      '.about-portrait',
      '.about-callout',
      '.about-family',
      '.about-documents__head',
      '.about-documents__figure',
      '.about-documents__copy',
      '.about-closing',
      '.about-colophon'
    ];
    const boxes = selectors.map((selector) => {
      const element = about.querySelector(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    });
    const columnYPositions = [...about.querySelectorAll('.about-closing__column')].map(
      (element) => element.getBoundingClientRect().y
    );

    return {
      boxes,
      columnYPositions,
      originDisplay: getComputedStyle(about.querySelector('.about-origin') as Element).display,
      documentsDisplay: getComputedStyle(
        about.querySelector('.about-documents') as Element,
      ).display,
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });

  expect(layout.originDisplay).toBe('block');
  expect(Math.max(...layout.boxes.map(({ x }) => x)) - Math.min(...layout.boxes.map(({ x }) => x))).toBeLessThan(5);
  expect(Math.min(...layout.boxes.map(({ width }) => width))).toBeGreaterThan(330);
  expect(layout.boxes[0].y).toBeLessThan(layout.boxes[1].y);
  expect(layout.boxes[1].y).toBeLessThan(layout.boxes[2].y);
  expect(layout.boxes[2].y).toBeLessThan(layout.boxes[3].y);
  expect(layout.boxes[3].y).toBeLessThan(layout.boxes[4].y);
  expect(layout.boxes[4].y).toBeLessThan(layout.boxes[5].y);
  expect(layout.boxes[5].y).toBeLessThan(layout.boxes[6].y);
  expect(layout.boxes[6].y).toBeLessThan(layout.boxes[7].y);
  expect(layout.boxes[7].y).toBeLessThan(layout.boxes[8].y);
  expect(layout.documentsDisplay).toBe('block');
  expect(layout.columnYPositions).toHaveLength(2);
  expect(layout.columnYPositions[0]).toBeLessThan(layout.columnYPositions[1]);
  expect(layout.overflow).toBeLessThanOrEqual(0);
});

test('waits for a comfortable measure before enabling the grids', async ({ page }) => {
  await page.setViewportSize({ width: 880, height: 900 });
  await page.goto('/about/');

  const displays = await page.locator('.about-page').evaluate((about) => ({
    origin: getComputedStyle(about.querySelector('.about-origin') as Element).display,
    family: getComputedStyle(about.querySelector('.about-family') as Element).display,
    documents: getComputedStyle(about.querySelector('.about-documents') as Element).display,
    closing: getComputedStyle(about.querySelector('.about-closing') as Element).display,
    overflow: document.documentElement.scrollWidth - window.innerWidth
  }));

  expect(displays.origin).toBe('block');
  expect(displays.family).toBe('block');
  expect(displays.documents).toBe('block');
  expect(displays.closing).toBe('block');
  expect(displays.overflow).toBeLessThanOrEqual(0);
});

test('prints the About page in one column', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/about/');
  await page.emulateMedia({ media: 'print' });

  const printLayout = await page.locator('.about-page').evaluate((about) => {
    const secondColumn = about.querySelector(
      '.about-closing__column + .about-closing__column',
    ) as Element;
    return {
      origin: getComputedStyle(about.querySelector('.about-origin') as Element).display,
      family: getComputedStyle(about.querySelector('.about-family') as Element).display,
      documents: getComputedStyle(about.querySelector('.about-documents') as Element).display,
      closing: getComputedStyle(about.querySelector('.about-closing') as Element).display,
      secondColumnRule: getComputedStyle(secondColumn).borderInlineStartWidth
    };
  });

  expect(printLayout.origin).toBe('block');
  expect(printLayout.family).toBe('block');
  expect(printLayout.documents).toBe('block');
  expect(printLayout.closing).toBe('block');
  expect(printLayout.secondColumnRule).toBe('0px');
});
