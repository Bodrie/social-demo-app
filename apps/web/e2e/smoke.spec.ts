import { expect, test } from '@playwright/test';
import { ALICE, ANONYMOUS } from './helpers.js';

test.use({ storageState: ANONYMOUS });

test.describe('smoke', () => {
  test('anonymous visitors land on the sign-in page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('wrong credentials are rejected with the API message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ALICE.email);
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Invalid email or password')).toBeVisible();
  });

  test('sign in, use the shell, toggle the theme, sign out', async ({ page }) => {
    await page.goto('/users');
    await page.getByLabel('Email').fill(ALICE.email);
    await page.getByLabel('Password').fill(ALICE.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Returned to the page that was originally requested, with the shell around it.
    await expect(page).toHaveURL(/\/users$/);
    await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();

    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Home' })
      .click();
    await expect(page.getByLabel('New post')).toHaveAttribute(
      'placeholder',
      "What's on your mind, Alice?",
    );

    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    // The session is really gone: a protected page redirects again.
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('is usable on a phone-sized screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await page.getByLabel('Email').fill(ALICE.email);
    await page.getByLabel('Password').fill(ALICE.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByLabel('New post')).toBeVisible();

    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('link', { name: 'People' }).click();
    await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();
  });
});
