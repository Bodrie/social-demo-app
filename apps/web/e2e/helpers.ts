import path from 'node:path';
import { type Page, expect } from '@playwright/test';

export const ALICE = { email: 'alice@example.com', password: 'Password123!', name: 'Alice' };

/** Written by auth.setup.ts; the `chromium` project starts every test with these cookies. */
export const STORAGE_STATE = path.join(import.meta.dirname, '.auth', 'alice.json');

/** For specs that must start signed out (the auth flows themselves). */
export const ANONYMOUS = { cookies: [], origins: [] };

/** Opens the home feed with the stored session and waits for it. */
export async function openHome(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByLabel('New post')).toBeVisible();
}

/** Signs in through the UI; only for specs that test the sign-in flow itself. */
export async function signIn(page: Page, user = ALICE): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByLabel('New post')).toBeVisible();
}
