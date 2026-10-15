import { expect, test } from '@playwright/test';
import { ANONYMOUS, USERS, signIn } from './helpers.js';

test.describe('registration', () => {
  test.use({ storageState: ANONYMOUS });

  test('a new member registers, is signed in, signs out and can sign in again', async ({
    page,
  }) => {
    const stamp = Date.now().toString(36);
    const member = {
      username: `pw_${stamp}`,
      name: `Play Wright ${stamp}`,
      email: `pw_${stamp}@example.com`,
    };

    await page.goto('/register');
    await page.getByLabel('Username').fill(member.username);
    await page.getByLabel('Name', { exact: true }).fill(member.name);
    await page.getByLabel('Email').fill(member.email);
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByLabel('New post')).toHaveAttribute(
      'placeholder',
      "What's on your mind, Play?",
    );
    await expect(page.getByRole('heading', { name: 'Your feed is empty' })).toBeVisible();

    await page.getByRole('button', { name: /account menu/i }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Email').fill(member.email);
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByLabel('New post')).toBeVisible();
    await page.getByRole('button', { name: /account menu/i }).click();
    await page.getByRole('menuitem', { name: 'Profile' }).click();
    await expect(page.getByRole('heading', { level: 1, name: member.name })).toBeVisible();
  });

  test('taken usernames and emails are reported on the field', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Username').fill(USERS.alice.username);
    await page.getByLabel('Name', { exact: true }).fill('Someone Else');
    await page.getByLabel('Email').fill(USERS.alice.email);
    await page.getByLabel('Password').fill('Password123!');
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
    await page.getByLabel('Password').fill(USERS.alice.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/activity$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Activity' })).toBeVisible();
  });
});
