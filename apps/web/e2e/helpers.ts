import { type Page, expect } from '@playwright/test';

export const ALICE = { email: 'alice@example.com', password: 'Password123!', name: 'Alice' };

/** Signs in through the UI and waits for the home feed. */
export async function signIn(page: Page, user = ALICE): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByLabel('New post')).toBeVisible();
}
