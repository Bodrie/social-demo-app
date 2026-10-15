import { expect, test } from '@playwright/test';
import { openHome } from './helpers.js';

test.describe('when things go wrong', () => {
  test('the feed shows an error state and recovers on retry', async ({ page }) => {
    const feed = /\/api\/v1\/posts(\?.*)?$/;
    await page.route(feed, (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 500,
          code: 'INTERNAL_ERROR',
          message: 'Something broke',
        }),
      }),
    );
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
    await expect(page.getByText('Could not load your feed.')).toBeVisible();

    await page.unroute(feed);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('feed').getByRole('article').first()).toBeVisible();
  });

  test('unknown people and pages are explained inside the app', async ({ page }) => {
    await openHome(page);
    await page.goto('/u/nobody_here');
    await expect(page.getByRole('heading', { name: "This profile doesn't exist" })).toBeVisible();
    await page.getByRole('link', { name: 'Back to home' }).click();
    await expect(page.getByLabel('New post')).toBeVisible();

    await page.goto('/messages/nobody_here');
    await expect(page.getByRole('heading', { name: "This person doesn't exist" })).toBeVisible();
  });

  test('a wrong API answer is surfaced as a toast, not a crash', async ({ page }) => {
    await openHome(page);
    await page.route('**/api/v1/posts/*/like', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Nope' }),
      }),
    );
    const post = page.getByRole('feed').getByRole('article').first();
    const like = post.getByRole('button', { name: /^(Like|Unlike)/ });
    const before = await like.textContent();
    await like.click();
    await expect(page.getByText('Could not update the like')).toBeVisible();
    await expect(like).toHaveText(before ?? '');
  });
});
