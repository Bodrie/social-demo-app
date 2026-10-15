import { expect, test as setup } from '@playwright/test';
import { ALICE, STORAGE_STATE } from './helpers.js';

/**
 * Signs in once per run and stores the cookies for the authenticated project.
 * Every spec reusing this state saves a login, which keeps the suite well under
 * the API's credential throttle (10 sign-ins per account per minute).
 */
setup('sign in as alice', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ALICE.email);
  await page.getByLabel('Password').fill(ALICE.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByLabel('New post')).toBeVisible();
  await page.context().storageState({ path: STORAGE_STATE });
});
