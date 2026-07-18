import { expect, test } from '@playwright/test';

test.describe('subscribe coupon', () => {
  test('appears on a paper page with a working form target', async ({ page }) => {
    await page.goto('/papers/1/');
    const coupon = page.getByRole('complementary', { name: 'By Subscription' });
    await expect(coupon).toBeVisible();
    const form = coupon.locator('form');
    await expect(form).toHaveAttribute('action', '/api/subscribe');
    await expect(form).toHaveAttribute('method', 'post');
    await expect(coupon.getByRole('radio', { name: /Weekly Course/ })).toBeChecked();
    await expect(coupon.getByRole('radio', { name: /As It Happened/ })).toBeVisible();
    await expect(coupon.getByLabel('Email address')).toHaveAttribute('type', 'email');
  });

  test('subscribe page presents both programs', async ({ page }) => {
    await page.goto('/subscribe/');
    await expect(page.getByRole('heading', { name: 'The Weekly Course' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'As It Happened' })).toBeVisible();
    await expect(page.getByText(/October 27/)).toBeVisible();
  });

  test('result pages render', async ({ page }) => {
    await page.goto('/subscribe/check-inbox/');
    await expect(page.getByRole('heading', { name: /confirmation/i })).toBeVisible();
    await page.goto('/subscribe/confirmed/');
    await expect(page.getByText(/Confirmed/i)).toBeVisible();
  });
});
