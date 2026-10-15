import path from 'node:path';
import { type Browser, type BrowserContext, type Page, expect } from '@playwright/test';

/** The seeded accounts (see apps/api/prisma/seed.ts); every one has the same password. */
export const PASSWORD = 'Password123!';
export const USERS = {
  alice: {
    username: 'alice',
    email: 'alice@example.com',
    name: 'Alice Anderson',
    password: PASSWORD,
  },
  bob: { username: 'bob', email: 'bob@example.com', name: 'Bob Brown', password: PASSWORD },
  carol: { username: 'carol', email: 'carol@example.com', name: 'Carol Clark', password: PASSWORD },
} as const;
export type SeededUser = keyof typeof USERS;

export const ALICE = { ...USERS.alice, name: 'Alice' };

/** Written by auth.setup.ts; the `chromium` project starts every test as alice. */
export const stateFor = (user: SeededUser): string =>
  path.join(import.meta.dirname, '.auth', `${user}.json`);
export const STORAGE_STATE = stateFor('alice');

/** For specs that must start signed out (the auth flows themselves). */
export const ANONYMOUS = { cookies: [], origins: [] };

/** Opens the home feed with the stored session and waits for it. */
export async function openHome(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByLabel('New post')).toBeVisible();
}

/** A second browser context signed in as another seeded member (no extra login needed). */
export async function contextAs(browser: Browser, user: SeededUser): Promise<BrowserContext> {
  return browser.newContext({ storageState: stateFor(user) });
}

/** Signs in through the UI; only for specs that test the sign-in flow itself. */
export async function signIn(
  page: Page,
  user: { email: string; password: string } = USERS.alice,
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByLabel('New post')).toBeVisible();
}
