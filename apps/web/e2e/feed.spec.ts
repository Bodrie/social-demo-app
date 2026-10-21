import path from 'node:path';
import { expect, test } from '@playwright/test';
import { openHome } from './helpers.js';

const PHOTO = path.join(import.meta.dirname, 'fixtures', 'photo.png');

test.describe('feed', () => {
  test('publish a post with two pictures, view them, like it, comment, then delete everything', async ({
    page,
  }) => {
    await openHome(page);
    const text = `Hello from Playwright ${Date.now()}`;

    await page.getByLabel('New post').fill(text);
    await page.getByLabel('Attach an image').setInputFiles([PHOTO, PHOTO]);
    await expect(page.getByRole('img', { name: /^Attachment preview \d$/ })).toHaveCount(2);
    const publish = page.getByRole('button', { name: 'Post', exact: true });
    await expect(publish).toBeEnabled();
    await publish.click();

    const post = page.getByRole('article').filter({ hasText: text }).first();
    await expect(post).toBeVisible();
    await expect(page.getByLabel('New post')).toHaveValue('');

    // Both pictures sit side by side; the viewer pages between them and gives focus back.
    const second = post.getByRole('button', { name: 'Open picture 2 of 2' });
    await expect(post.getByRole('button', { name: 'Open picture 1 of 2' })).toBeVisible();
    await second.click();
    const viewer = page.getByRole('dialog', { name: 'Pictures posted by Alice Anderson' });
    await expect(
      viewer.getByRole('img', { name: 'Posted by Alice Anderson, 2 of 2' }),
    ).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(
      viewer.getByRole('img', { name: 'Posted by Alice Anderson, 1 of 2' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(viewer).toBeHidden();
    await expect(second).toBeFocused();

    // Like, then unlike: the count and the pressed state follow.
    const like = post.getByRole('button', { name: /^Like/ });
    await like.click();
    await expect(like).toHaveAttribute('aria-pressed', 'true');
    await expect(like).toContainText('1');
    await like.click();
    await expect(like).toHaveAttribute('aria-pressed', 'false');
    await expect(like).toContainText('0');

    // Comment and remove the comment again.
    await post.getByRole('button', { name: /^Comments/ }).click();
    await post.getByLabel('Write a comment').fill('Nice one!');
    await post.getByRole('button', { name: 'Send comment' }).click();
    await expect(post.getByText('Nice one!')).toBeVisible();
    await expect(post.getByRole('button', { name: /^Comments/ })).toContainText('1');
    await post.getByRole('button', { name: 'Comment options' }).click();
    await page.getByRole('menuitem', { name: 'Delete comment' }).click();
    await expect(post.getByText('Nice one!')).toBeHidden();
    await expect(post.getByRole('button', { name: /^Comments/ })).toContainText('0');

    // Delete the post through the menu and the confirmation dialog.
    await post.getByRole('button', { name: 'Post options' }).click();
    await page.getByRole('menuitem', { name: 'Delete post' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('article').filter({ hasText: text })).toHaveCount(0);
  });

  test('loads older posts while scrolling until the end of the feed', async ({ page }) => {
    await openHome(page);
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
