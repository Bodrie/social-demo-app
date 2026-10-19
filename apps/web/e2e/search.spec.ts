import { expect, test } from '@playwright/test';
import { openHome } from './helpers.js';

test.describe('post pages and search', () => {
  test('a post opens on its own page from the feed and turns up in a search', async ({ page }) => {
    await openHome(page);
    const stamp = Date.now().toString(36);
    const text = `Permalink check ${stamp}`;
    await page.getByLabel('New post').fill(text);
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    const card = page.getByRole('article').filter({ hasText: text }).first();
    await expect(card).toBeVisible();

    await card.locator('a[href^="/p/"]').first().click();
    await expect(page).toHaveURL(/\/p\/[0-9a-f-]+$/);
    const post = page.getByRole('article').filter({ hasText: text });
    await expect(post).toBeVisible();
    await expect(post.getByRole('region', { name: 'Comments' })).toBeVisible();
    await expect(page).toHaveTitle(/Post by Alice/);

    await page.getByRole('searchbox', { name: 'Search' }).fill(`permalink ${stamp}`);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible();
    await expect(
      page
        .getByRole('feed', { name: /Posts matching/ })
        .getByRole('article')
        .filter({ hasText: text }),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'People' }).click();
    await expect(page.getByRole('heading', { name: /No one matches/ })).toBeVisible();

    // Clean up from the result card (back on the Posts tab).
    await page.getByRole('tab', { name: 'Posts' }).click();
    await page.getByRole('button', { name: 'Post options' }).click();
    await page.getByRole('menuitem', { name: 'Delete post' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('heading', { name: /No posts match/ })).toBeVisible();
  });

  test('people are searchable too and a missing post has its own page', async ({ page }) => {
    await openHome(page);
    await page.goto('/search?q=bob&type=people');
    await expect(
      page.getByRole('list', { name: 'People matching “bob”' }).getByText('Bob Brown'),
    ).toBeVisible();
    await page.goto('/p/01a13f00-0000-7000-8000-000000000999');
    await expect(page.getByRole('heading', { name: 'This post is gone' })).toBeVisible();
  });
});
