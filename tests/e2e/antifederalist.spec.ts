import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('the opposition shelf', () => {
  test('index lists eight essays and tracks read state', async ({ page }) => {
    await page.goto('/antifederalist/');
    await expect(page.getByRole('heading', { name: 'The Anti-Federalist Papers' })).toBeVisible();
    await expect(page.locator('.index-entry')).toHaveCount(8);
    await expect(page.locator('[data-journal-progress]')).toHaveText('0 of 8 read in this browser');

    await page.goto('/antifederalist/brutus-1/');
    const control = page.locator('.reading-toolbar [data-progress-control]');
    await expect(control).toHaveAttribute('aria-pressed', 'false');
    await expect(control).toHaveAttribute('aria-label', 'Mark as read');
    await control.click();
    await expect(control).toHaveAttribute('aria-pressed', 'true');
    await expect(control).toHaveAttribute('aria-label', 'Marked as read');

    await page.goto('/antifederalist/');
    await expect(page.locator('[data-journal-progress]')).toHaveText('1 of 8 read in this browser');
    const brutusOne = page.locator('[data-journal-entry="101"]');
    await expect(brutusOne).toHaveAttribute('data-read', 'true');
    const status = brutusOne.locator('[data-journal-status]');
    await expect(status).toHaveAttribute('aria-pressed', 'true');
    await expect(status).toHaveAttribute('aria-label', 'Mark Brutus No. I as unread');
    await expect(status).toHaveText(/Read/);
  });

  test('a shelf row status toggle flips read state in place', async ({ page }) => {
    await page.goto('/antifederalist/');
    const catoFour = page.locator('[data-journal-entry="154"]');
    const status = catoFour.locator('[data-journal-status]');
    await expect(status).toHaveAttribute('aria-pressed', 'false');
    await expect(status).toHaveAttribute('aria-label', 'Mark Cato No. IV as read');

    await status.click();
    await expect(status).toHaveAttribute('aria-pressed', 'true');
    await expect(status).toHaveAttribute('aria-label', 'Mark Cato No. IV as unread');
    await expect(catoFour).toHaveAttribute('data-read', 'true');
    await expect(page.locator('[data-journal-progress]')).toHaveText('1 of 8 read in this browser');

    await status.click();
    await expect(status).toHaveAttribute('aria-pressed', 'false');
    await expect(catoFour).toHaveAttribute('data-read', 'false');
    await expect(page.locator('[data-journal-progress]')).toHaveText('0 of 8 read in this browser');
  });

  test('essay renders in both modes with the Journal identity', async ({ page }) => {
    await page.goto('/antifederalist/brutus-1/');
    await expect(page.locator('.gazette-masthead__art')).toHaveAttribute(
      'src',
      '/masthead-new-york-journal.svg'
    );
    await expect(page.locator('.gazette-masthead__motto')).toContainText('TRUTH unlicens’d reigns');
    await expect(page.locator('.essay-signature')).toHaveText(/BRUTUS/);

    await page.getByRole('button', { name: 'Reader' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-reading-mode', 'reader');
    await page.getByRole('button', { name: 'Gazette' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-reading-mode', 'gazette');
  });

  test('cross-links run both directions', async ({ page }) => {
    await page.goto('/antifederalist/brutus-12/');
    await page.getByRole('link', { name: /Federalist No\. 78/ }).click();
    await expect(page).toHaveURL(/\/papers\/78\/$/);
    await page.getByRole('link', { name: /Brutus No\. XII/ }).click();
    await expect(page).toHaveURL(/\/antifederalist\/brutus-12\/$/);
  });
});

for (const path of ['/antifederalist/', '/antifederalist/brutus-1/']) {
  test(`${path} has no automatically detectable accessibility violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}
