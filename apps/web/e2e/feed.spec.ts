import path from 'node:path';
import { expect, test } from '@playwright/test';
import { signIn } from './helpers.js';

const PHOTO = path.join(import.meta.dirname, 'fixtures', 'photo.png');

test.describe('feed', () => {
  test('publish a post with an image, like it, comment, then delete everything', async ({
    page,
  }) => {
    await signIn(page);
    const text = `Hello from Playwright ${Date.now()}`;

    await page.getByLabel('New post').fill(text);
    await page.getByLabel('Attach an image').setInputFiles(PHOTO);
    await expect(page.getByRole('img', { name: 'Attachment preview' })).toBeVisible();
    const publish = page.getByRole('button', { name: 'Post', exact: true });
    await expect(publish).toBeEnabled();
    await publish.click();

    const post = page.getByRole('article').filter({ hasText: text }).first();
    await expect(post).toBeVisible();
    await expect(post.getByRole('img', { name: /Posted by Alice/ })).toBeVisible();
    await expect(page.getByLabel('New post')).toHaveValue('');

    // Like, then unlike: the count and the pressed state follow.
    await post.getByRole('button', { name: /^Like/ }).click();
    const unlike = post.getByRole('button', { name: /^Unlike/ });
    await expect(unlike).toHaveAttribute('aria-pressed', 'true');
    await expect(unlike).toContainText('1');
    await unlike.click();
    await expect(post.getByRole('button', { name: /^Like/ })).toContainText('0');

    // Comment and remove the comment again.
    await post.getByRole('button', { name: /^Comments/ }).click();
    await post.getByLabel('Write a comment').fill('Nice one!');
    await post.getByRole('button', { name: 'Send comment' }).click();
    await expect(post.getByText('Nice one!')).toBeVisible();
    await expect(post.getByRole('button', { name: /^Comments/ })).toContainText('1');
    await post.getByRole('button', { name: 'Delete comment' }).click();
    await expect(post.getByText('Nice one!')).toBeHidden();
    await expect(post.getByRole('button', { name: /^Comments/ })).toContainText('0');

    // Delete the post through the menu and the confirmation dialog.
    await post.getByRole('button', { name: 'Post options' }).click();
    await page.getByRole('menuitem', { name: 'Delete post' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('article').filter({ hasText: text })).toHaveCount(0);
  });

  test('loads older posts while scrolling until the end of the feed', async ({ page }) => {
    await signIn(page);
    const articles = page.getByRole('feed').getByRole('article');
    await expect(articles.first()).toBeVisible();
    const firstPage = await articles.count();
    expect(firstPage).toBeLessThanOrEqual(20);

    await expect(async () => {
      await articles.last().scrollIntoViewIfNeeded();
      await expect(page.getByText("You're all caught up.")).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 20_000 });
    expect(await articles.count()).toBeGreaterThanOrEqual(firstPage);
  });
});
