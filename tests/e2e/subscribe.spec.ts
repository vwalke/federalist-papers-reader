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
    await expect(page.getByText(/October 27/)).toBeVisible();

    const coupon = page.getByRole('complementary', { name: 'By Subscription' });
    await expect(coupon).toBeVisible();
    const form = coupon.locator('form');
    await expect(form).toHaveAttribute('action', '/api/subscribe');
    await expect(form).toHaveAttribute('method', 'post');
    await expect(coupon.getByRole('radio', { name: /Weekly Course/ })).toBeChecked();
    await expect(coupon.getByRole('radio', { name: /As It Happened/ })).toBeVisible();
    await expect(coupon.getByLabel('Email address')).toHaveAttribute('type', 'email');
  });

  test('result pages render', async ({ page }) => {
    await page.goto('/subscribe/check-inbox/');
    await expect(page.getByRole('heading', { name: /confirmation/i })).toBeVisible();
    await page.goto('/subscribe/confirmed/');
    await expect(page.getByText(/Confirmed/i)).toBeVisible();
  });
});
