import { expect, test } from '@playwright/test';
import { USERS, contextAs } from './helpers.js';

test.describe('settings', () => {
  // Carol's password changes for the rest of the run; no other spec signs her in through the form.
  test('change the password, stay signed in, then sign in again with the new one', async ({
    browser,
  }) => {
    const page = await (await contextAs(browser, 'carol')).newPage();
    await page.goto('/');
    await page.getByRole('button', { name: /account menu/i }).click();
    await page.getByRole('menuitem', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();

    await page.getByLabel('Current password').fill('wrong-one');
    await page.getByLabel('New password', { exact: true }).fill('Brand-new-pass-1');
    await page.getByLabel('Confirm new password').fill('Brand-new-pass-1');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText('Wrong password')).toBeVisible();

    await page.getByLabel('Current password').fill(USERS.carol.password);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText(/Password changed/)).toBeVisible();

    // Still signed in here; a fresh sign-in needs the new password.
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Home' })
      .click();
    await expect(page.getByLabel('New post')).toBeVisible();
    await page.getByRole('button', { name: /account menu/i }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Email').fill(USERS.carol.email);
    await page.getByLabel('Password', { exact: true }).fill(USERS.carol.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Invalid email or password')).toBeVisible();
    await page.getByLabel('Password', { exact: true }).fill('Brand-new-pass-1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByLabel('New post')).toBeVisible();
    await page.context().close();
  });

  test('theme choice persists', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('group', { name: 'Theme' }).getByRole('button', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page
      .getByRole('group', { name: 'Theme' })
      .getByRole('button', { name: 'System' })
      .click();
  });
});
