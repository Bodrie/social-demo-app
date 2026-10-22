import { expect, test } from '@playwright/test';
import { USERS, contextAs, openHome } from './helpers.js';

test('a report filed by a member shows up for the admin, who settles it', async ({
  page,
  browser,
}) => {
  const note = `Please look ${Date.now()}`;
  const carol = await (await contextAs(browser, 'carol')).newPage();
  await carol.goto(`/u/${USERS.bob.username}`);
  // A seeded post of bob's, not "the first one": other specs post, repost and delete as bob
  // while this one runs.
  const post = carol
    .getByRole('article')
    .filter({ hasText: 'New #photography set from the coast' })
    .first();
  await post.getByRole('button', { name: 'Post options' }).click();
  await carol.getByRole('menuitem', { name: 'Report post' }).click();
  const dialog = carol.getByRole('dialog', { name: 'Report this post' });
  await dialog.getByLabel('Hate speech').check();
  await dialog.getByLabel('Details (optional)').fill(note);
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(carol.getByText('Thank you. We will look into it.')).toBeVisible();
  await carol.context().close();

  // alice is the seeded admin: the queue is in her account menu.
  await openHome(page);
  await page.getByRole('button', { name: /account menu/i }).click();
  await page.getByRole('menuitem', { name: 'Admin' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Reports' })).toBeVisible();
  const item = page
    .getByRole('list', { name: 'Reports' })
    .getByRole('listitem')
    .filter({ hasText: note })
    .first();
  await expect(item).toContainText(USERS.carol.name);
  await expect(item).toContainText('Hate speech');
  await expect(item).toContainText(USERS.bob.name);

  await item.getByRole('button', { name: 'Resolve' }).click();
  await expect(item).toHaveCount(0);
  await page.getByRole('button', { name: 'Resolved' }).click();
  await expect(
    page.getByRole('list', { name: 'Reports' }).getByRole('listitem').filter({ hasText: note }),
  ).toHaveCount(1);
});
