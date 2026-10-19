import { expect, test } from '@playwright/test';
import { ANONYMOUS, PASSWORD, latestEmail, registerAndConfirm } from './helpers.js';

test.describe('account', () => {
  test.use({ storageState: ANONYMOUS });

  test('a member downloads their data, then deletes the account for good', async ({ page }) => {
    const member = await registerAndConfirm(page);
    await page.goto('/settings');

    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download your data' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(
      new RegExp(`^the-mesh-export-${member.username}-\\d{4}-\\d{2}-\\d{2}\\.json$`),
    );

    await page.getByRole('button', { name: 'Delete account' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete your account?' });
    await dialog.getByLabel('Your password').fill('not-my-password');
    await dialog.getByRole('button', { name: 'Delete my account' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Wrong password');

    await dialog.getByLabel('Your password').fill(PASSWORD);
    await dialog.getByRole('button', { name: 'Delete my account' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Email').fill(member.email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Invalid email or password')).toBeVisible();

    const mail = await latestEmail(member.email, /account was deleted/);
    expect(mail.text).toContain(member.name);
  });
});
