import { expect, test } from '@playwright/test';
import { openHome } from './helpers.js';

test('saves a post from the feed, finds it under Bookmarks and removes it again', async ({
  page,
}) => {
  await openHome(page);
  const text = `Keep this ${Date.now()}`;
  await page.getByLabel('New post').fill(text);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  const post = page.getByRole('article').filter({ hasText: text }).first();
  await expect(post).toBeVisible();

  const save = post.getByRole('button', { name: 'Bookmark' });
  await save.click();
  await expect(save).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: /account menu/i }).click();
  await page.getByRole('menuitem', { name: 'Bookmarks' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Bookmarks' })).toBeVisible();
  const saved = page
    .getByRole('feed', { name: 'Bookmarks' })
    .getByRole('article')
    .filter({ hasText: text });
  await expect(saved).toBeVisible();
  await saved.getByRole('button', { name: 'Bookmark' }).click();
  await expect(saved).toHaveCount(0);

  // Clean up the post so other specs see the seeded feed.
  await page.goto('/');
  const mine = page.getByRole('article').filter({ hasText: text }).first();
  await expect(mine.getByRole('button', { name: 'Bookmark' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await mine.getByRole('button', { name: 'Post options' }).click();
  await page.getByRole('menuitem', { name: 'Delete post' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('article').filter({ hasText: text })).toHaveCount(0);
});
