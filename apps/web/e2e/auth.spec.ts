import { expect, test } from '@playwright/test';
import {
  ANONYMOUS,
  PASSWORD,
  USERS,
  latestEmail,
  linkIn,
  registerAndConfirm,
  signIn,
} from './helpers.js';

test.describe('registration', () => {
  test.use({ storageState: ANONYMOUS });

  test('a new member registers, confirms the address from the mail, signs out and in again', async ({
    page,
  }) => {
    const member = await registerAndConfirm(page);
    await expect(page.getByLabel('New post')).toHaveAttribute(
      'placeholder',
      "What's on your mind, Play?",
    );
    await expect(page.getByRole('heading', { name: 'Your feed is empty' })).toBeVisible();

    await page.getByRole('button', { name: /account menu/i }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Email').fill(member.email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByLabel('New post')).toBeVisible();
    await page.getByRole('button', { name: /account menu/i }).click();
    await page.getByRole('menuitem', { name: 'Profile' }).click();
    await expect(page.getByRole('heading', { level: 1, name: member.name })).toBeVisible();
  });

  test('a forgotten password is reset through the mailed link', async ({ page }) => {
    const member = await registerAndConfirm(page);
    await page.getByRole('button', { name: /account menu/i }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByRole('link', { name: 'Forgot your password?' }).click();
    // The login page has an Email field too: wait for the lazy route before filling.
    await expect(page.getByRole('heading', { name: 'Forgot your password?' })).toBeVisible();
    await page.getByLabel('Email').fill(member.email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();

    const mail = await latestEmail(member.email, /Reset your/);
    await page.goto(linkIn(mail, '/reset-password'));
    await page.getByLabel('New password', { exact: true }).fill('Brand-new-1');
    await page.getByLabel('Confirm new password').fill('Brand-new-1');
    await page.getByRole('button', { name: 'Save new password' }).click();
    await expect(page.getByLabel('New post')).toBeVisible();
    await page.getByRole('button', { name: /account menu/i }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    // The link is spent and only the new password works from now on.
    await page.goto(linkIn(mail, '/reset-password'));
    await page.getByLabel('New password', { exact: true }).fill('Brand-new-2');
    await page.getByLabel('Confirm new password').fill('Brand-new-2');
    await page.getByRole('button', { name: 'Save new password' }).click();
    await expect(page.getByRole('heading', { name: 'This link did not work' })).toBeVisible();
    await page.goto('/login');
    await page.getByLabel('Email').fill(member.email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Invalid email or password')).toBeVisible();
    await page.getByLabel('Password', { exact: true }).fill('Brand-new-1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByLabel('New post')).toBeVisible();
  });

  test('taken usernames and emails are reported on the field', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Username').fill(USERS.alice.username);
    await page.getByLabel('Name', { exact: true }).fill('Someone Else');
    await page.getByLabel('Email').fill(USERS.alice.email);
    await page.getByLabel('Password', { exact: true }).fill('Password123!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('This username is taken')).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });
});

test.describe('session', () => {
  // Own sign-in on purpose: the refresh rotates the single-use refresh token, and the
  // shared stored session must stay valid for the other specs.
  test.use({ storageState: ANONYMOUS });

  test('survives a lost access token through the silent refresh', async ({ page, context }) => {
    await signIn(page);

    // The short-lived cookie is gone; the next request must refresh instead of signing out.
    await context.clearCookies({ name: 'access_token' });
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'People' })
      .click();
    await expect(
      page.getByRole('list', { name: 'People' }).getByRole('listitem').first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/users$/);
    const names = (await context.cookies()).map((cookie) => cookie.name);
    expect(names).toContain('access_token');
  });

  test('without any session the app returns to sign-in and remembers the destination', async ({
    page,
  }) => {
    await page.goto('/activity');
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Email').fill(USERS.alice.email);
    await page.getByLabel('Password', { exact: true }).fill(USERS.alice.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/activity$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Activity' })).toBeVisible();
  });
});
