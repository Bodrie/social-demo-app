import { type Browser, expect, test as setup } from '@playwright/test';
import { type SeededUser, USERS, stateFor } from './helpers.js';

/**
 * Signs in once per seeded member and stores the cookies. Specs reuse them instead of
 * logging in, which keeps the suite far below the API's credential throttle
 * (10 sign-ins per account per minute, 30 per address).
 */
async function storeSession(browser: Browser, user: SeededUser): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(USERS[user].email);
  await page.getByLabel('Password', { exact: true }).fill(USERS[user].password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByLabel('New post')).toBeVisible();
  await context.storageState({ path: stateFor(user) });
  await context.close();
}

setup('sign in as the seeded members', async ({ browser }) => {
  await Promise.all(
    (['alice', 'bob', 'carol'] as const).map((user) => storeSession(browser, user)),
  );
});
