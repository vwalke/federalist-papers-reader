import { expect, test } from '@playwright/test';

test.describe('subscribe surfaces', () => {
  test('a paper page carries the delivery prompt beside the share colophon', async ({ page }) => {
    await page.goto('/papers/1/');
    const prompt = page.getByRole('complementary', { name: 'Have it delivered' });
    await expect(prompt).toBeVisible();
    const link = prompt.getByRole('link', { name: 'Subscribe by post' });
    await expect(link).toHaveAttribute('href', '/subscribe/');
    await expect(page.getByRole('complementary', { name: 'Share this paper' })).toBeVisible();
  });

  test('subscribe page presents both programs and the signup form', async ({ page }) => {
    await page.goto('/subscribe/');
    await expect(page.getByRole('heading', { name: 'The Weekly Course' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'As It Happened' })).toBeVisible();
    await expect(page.getByText(/October 18 with Brutus No/)).toBeVisible();

    const coupon = page.getByRole('complementary', { name: 'By Subscription' });
    await expect(coupon).toBeVisible();
    const form = coupon.locator('form');
    await expect(form).toHaveAttribute('action', '/api/subscribe');
    await expect(form).toHaveAttribute('method', 'post');
    await expect(coupon.getByRole('radio', { name: /Weekly Course/ })).toBeChecked();
    await expect(coupon.getByRole('radio', { name: /As It Happened/ })).toBeVisible();
    await expect(coupon.getByLabel('Email address')).toHaveAttribute('type', 'email');
  });

  test('offers As It Happened catch-up only inside the window, beneath that program', async ({ page }) => {
    // Tuesday November 10, 2026, after the morning run: eight already printed.
    await page.clock.install({ time: new Date('2026-11-10T17:00:00Z') });
    await page.goto('/subscribe/');
    const coupon = page.getByRole('complementary', { name: 'By Subscription' });
    const catchUp = coupon.getByRole('checkbox', { name: /Catch up on the eight already printed/ });
    await expect(catchUp).toBeHidden();
    await coupon.getByRole('radio', { name: /As It Happened/ }).check();
    await expect(catchUp).toBeVisible();
    await expect(catchUp).toBeChecked();
    await expect(catchUp).toBeEnabled();
    await coupon.getByRole('radio', { name: /Weekly Course/ }).check();
    await expect(catchUp).toBeHidden();
    // Disabled while hidden, so a Weekly signup never submits it.
    await expect(coupon.locator('input[name="catchup"]')).toBeDisabled();
  });

  test('no catch-up offer after the cut-off', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-22T17:00:00Z') });
    await page.goto('/subscribe/');
    const coupon = page.getByRole('complementary', { name: 'By Subscription' });
    await coupon.getByRole('radio', { name: /As It Happened/ }).check();
    await expect(coupon.locator('input[name="catchup"]')).toBeHidden();
    await expect(coupon.locator('input[name="catchup"]')).toBeDisabled();
  });

  test('result pages render', async ({ page }) => {
    await page.goto('/subscribe/check-inbox/');
    await expect(page.getByRole('heading', { name: /confirmation/i })).toBeVisible();
    await page.goto('/subscribe/confirmed/');
    await expect(page.getByText(/Confirmed/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Read Federalist No. 1' })).toHaveAttribute(
      'href',
      '/papers/1/',
    );
    await expect(page.getByRole('link', { name: 'browse the full collection' })).toHaveAttribute(
      'href',
      '/#all-papers',
    );
    await expect(page.locator('a[href*="x.com"], a[href*="twitter.com"]')).toHaveCount(0);
  });
});
