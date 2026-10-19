import { expect, test } from '@playwright/test';
import { openHome } from './helpers.js';

test.describe('mentions and hashtags', () => {
  test('the composer offers members, the post links them and the tag has its page', async ({
    page,
  }) => {
    await openHome(page);
    const tag = `pw${Date.now().toString(36)}`;
    const box = page.getByLabel('New post');

    await box.fill(`Trying #${tag} with `);
    await box.pressSequentially('@bob');
    const listbox = page.getByRole('listbox', { name: 'Members' });
    await expect(listbox.getByRole('option', { name: /Bob Brown/ })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(box).toHaveValue(`Trying #${tag} with @bob `);
    await page.getByRole('button', { name: 'Post', exact: true }).click();

    const post = page
      .getByRole('article')
      .filter({ hasText: `#${tag}` })
      .first();
    await expect(post.getByRole('link', { name: '@bob' })).toHaveAttribute('href', '/u/bob');

    await post.getByRole('link', { name: `#${tag}` }).click();
    await expect(page.getByRole('heading', { level: 1, name: `#${tag}` })).toBeVisible();
    const feed = page.getByRole('feed', { name: `Posts tagged #${tag}` });
    await expect(feed.getByRole('article')).toHaveCount(1);

    // Clean up from the tag page: the list empties as the post goes.
    await feed.getByRole('button', { name: 'Post options' }).click();
    await page.getByRole('menuitem', { name: 'Delete post' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('heading', { name: 'Nothing here yet' })).toBeVisible();
  });

  test('seeded tags have pages and an unknown address keeps the shell', async ({ page }) => {
    await openHome(page);
    await page.goto('/tags/WEEKEND');
    await expect(page.getByRole('heading', { level: 1, name: '#weekend' })).toBeVisible();
    await expect(
      page.getByRole('feed', { name: 'Posts tagged #weekend' }).getByRole('article').first(),
    ).toBeVisible();
    await page.goto('/tags/2026');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});
