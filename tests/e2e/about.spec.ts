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

    const noteBoxes = [...about.querySelectorAll('.about-notes > section')].map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    });

    return {
      originDisplay: getComputedStyle(about.querySelector('.about-origin') as Element).display,
      familyDisplay: getComputedStyle(about.querySelector('.about-family') as Element).display,
      notesDisplay: getComputedStyle(about.querySelector('.about-notes') as Element).display,
      copy: box('.about-origin__copy'),
      portrait: box('.about-portrait'),
      callout: box('.about-callout'),
      familyHeading: box('.about-family__head'),
      familyCopy: box('.about-family__copy'),
      colophon: box('.about-colophon'),
      colophonTextAlign: getComputedStyle(about.querySelector('.about-colophon') as Element).textAlign,
      noteBoxes,
      overflow: document.documentElement.scrollWidth - window.innerWidth
    };
  });

  expect(layout.originDisplay).toBe('grid');
  expect(layout.familyDisplay).toBe('grid');
  expect(layout.notesDisplay).toBe('grid');
  expect(layout.copy.x).toBeLessThan(layout.portrait.x);
  expect(Math.abs(layout.copy.x - layout.callout.x)).toBeLessThan(2);
  expect(layout.callout.y).toBeGreaterThan(layout.copy.y);
  expect(layout.familyHeading.x).toBeLessThan(layout.familyCopy.x);
  expect(layout.noteBoxes).toHaveLength(2);
  expect(Math.abs(layout.noteBoxes[0].y - layout.noteBoxes[1].y)).toBeLessThan(2);
  expect(layout.colophon.y).toBeGreaterThan(
    Math.max(...layout.noteBoxes.map(({ y, height }) => y + height)),
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
      '.about-notes',
      '.about-colophon'
    ];
    const boxes = selectors.map((selector) => {
      const element = about.querySelector(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    });
    const noteYPositions = [...about.querySelectorAll('.about-notes > section')].map(
      (element) => element.getBoundingClientRect().y
    );

    return {
      boxes,
      noteYPositions,
      originDisplay: getComputedStyle(about.querySelector('.about-origin') as Element).display,
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
  expect(layout.noteYPositions).toHaveLength(2);
  expect(layout.noteYPositions[0]).toBeLessThan(layout.noteYPositions[1]);
  expect(layout.overflow).toBeLessThanOrEqual(0);
});

test('waits for a comfortable measure before enabling the grids', async ({ page }) => {
  await page.setViewportSize({ width: 880, height: 900 });
  await page.goto('/about/');

  const displays = await page.locator('.about-page').evaluate((about) => ({
    origin: getComputedStyle(about.querySelector('.about-origin') as Element).display,
    family: getComputedStyle(about.querySelector('.about-family') as Element).display,
    notes: getComputedStyle(about.querySelector('.about-notes') as Element).display,
    overflow: document.documentElement.scrollWidth - window.innerWidth
  }));

  expect(displays.origin).toBe('block');
  expect(displays.family).toBe('block');
  expect(displays.notes).toBe('block');
  expect(displays.overflow).toBeLessThanOrEqual(0);
});

test('prints the About page in one column', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/about/');
  await page.emulateMedia({ media: 'print' });

  const printLayout = await page.locator('.about-page').evaluate((about) => {
    const secondNote = about.querySelector('.about-notes > section:nth-child(2)') as Element;
    return {
      origin: getComputedStyle(about.querySelector('.about-origin') as Element).display,
      family: getComputedStyle(about.querySelector('.about-family') as Element).display,
      notes: getComputedStyle(about.querySelector('.about-notes') as Element).display,
      secondNoteDivider: getComputedStyle(secondNote).borderInlineStartWidth
    };
  });

  expect(printLayout.origin).toBe('block');
  expect(printLayout.family).toBe('block');
  expect(printLayout.notes).toBe('block');
  expect(printLayout.secondNoteDivider).toBe('0px');
});
