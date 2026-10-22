import { expect, test } from '@playwright/test';
import { ANONYMOUS, registerAndConfirm } from './helpers.js';

test.describe('achievements', () => {
  test.use({ storageState: ANONYMOUS });

  test('a newcomer’s first post earns a badge: toasts, the checklist and the Badges tab', async ({
    page,
  }) => {
    const member = await registerAndConfirm(page);
    const checklist = page.getByRole('region', { name: 'Getting started' });
    await expect(checklist).toContainText('0 of 6 done.');

    await page.getByLabel('New post').fill('Hello from a brand new member');
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByText('You earned “Hello, world”')).toBeVisible();
    await expect(checklist).toContainText('1 of 6 done.');

    // A hidden one: a post of emoji only.
    await page.getByLabel('New post').fill('🎉🎉');
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByText('You earned “Speechless”')).toBeVisible();

    // Toasts close after a few seconds; `/badges` is where a badge notification leads too.
    await page.goto('/badges');
    await expect(page).toHaveURL(new RegExp(`/u/${member.username}/badges$`));
    const gettingStarted = page.getByRole('region', { name: 'Getting started' });
    await expect(
      gettingStarted.getByRole('listitem').filter({ hasText: 'Hello, world' }),
    ).toContainText('Earned');
    await expect(
      gettingStarted.getByRole('listitem').filter({ hasText: 'Say cheese' }),
    ).toContainText('not earned yet');
    const hidden = page.getByRole('region', { name: 'Hidden' });
    await expect(hidden.getByText('Speechless')).toBeVisible();
    // A time-of-day badge may join it, depending on when the suite runs.
    await expect(hidden.getByText(/\d+ more to find/)).toBeVisible();
  });
});
