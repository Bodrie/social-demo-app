import path from 'node:path';
import { expect, test } from '@playwright/test';
import { openHome } from './helpers.js';

const PHOTO = path.join(import.meta.dirname, 'fixtures', 'photo.png');

const count = async (text: string | null) => Number(text?.match(/\d+/)?.[0] ?? NaN);

test.describe('profile', () => {
  test('follow and unfollow another member from their profile', async ({ page }) => {
    await openHome(page);
    // Feed posts come from alice herself or from people she follows, except what those people
    // reposted (ADR 0017): take the first original post by someone else.
    const post = page
      .getByRole('article')
      .filter({ hasNot: page.getByRole('link', { name: 'Alice Anderson' }) })
      .filter({ hasNotText: 'reposted' })
      .first();
    const author = post.getByRole('link').first();
    const name = (await author.textContent()) ?? '';
    await author.click();

    const header = page.getByRole('region', { name });
    await expect(header.getByRole('heading', { level: 1, name })).toBeVisible();
    const followers = header.getByRole('link', { name: /^\d+ Followers$/ });
    const before = await count(await followers.textContent());

    await header.getByRole('button', { name: 'Following' }).click();
    await expect(header.getByRole('button', { name: 'Follow', exact: true })).toBeVisible();
    await expect(followers).toHaveText(new RegExp(`^${before - 1} Followers$`));

    await header.getByRole('button', { name: 'Follow', exact: true }).click();
    await expect(header.getByRole('button', { name: 'Following' })).toBeVisible();
    await expect(followers).toHaveText(new RegExp(`^${before} Followers$`));

    await page.getByRole('link', { name: 'Followers', exact: true }).click();
    await expect(page).toHaveURL(/\/followers$/);
    await expect(
      page.getByRole('list', { name: 'Followers' }).getByRole('listitem').first(),
    ).toBeVisible();
  });

  test('edit the own profile with a new avatar', async ({ page }) => {
    await openHome(page);
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Profile' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Alice Anderson' })).toBeVisible();

    await page.getByRole('button', { name: 'Edit profile' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit profile' });
    const bio = `Playwright was here ${Date.now()}`;
    await dialog.getByLabel('Bio').fill(bio);
    await dialog.getByLabel('Choose avatar').setInputFiles(PHOTO);
    const save = dialog.getByRole('button', { name: 'Save changes' });
    await expect(save).toBeEnabled();
    await save.click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText(bio)).toBeVisible();
    await expect(page.locator('img[src*="/uploads/avatar/"]').first()).toBeVisible();
  });
});
