import { expect, test } from '@playwright/test';
import { ANONYMOUS, PASSWORD, latestEmail, linkIn, registerAndConfirm } from './helpers.js';

test.use({ storageState: ANONYMOUS });

test('a member moves the account to a new address and sees this browser among the sessions', async ({
  page,
}) => {
  const member = await registerAndConfirm(page);
  const newEmail = member.email.replace('@', '+moved@');

  await page.goto('/settings');
  await expect(page.getByText(`Your address is ${member.email}.`)).toBeVisible();
  await page.getByLabel('New email address').fill(newEmail);
  await page.getByLabel('Your password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Send confirmation link' }).click();
  await expect(page.getByText('Waiting for confirmation', { exact: false })).toBeVisible();

  // The link goes to the new address; opening it moves the account there.
  const mail = await latestEmail(newEmail, /Confirm your new email/);
  await page.goto(linkIn(mail, '/confirm-email'));
  await expect(page.getByRole('heading', { name: 'Email address changed' })).toBeVisible();
  await page.getByRole('link', { name: 'Continue' }).click();
  await page.goto('/settings');
  await expect(page.getByText(`Your address is ${newEmail}.`)).toBeVisible();
  // The old address was told.
  await latestEmail(member.email, /was changed/);

  // This browser is in the sessions list and marked as such.
  const sessions = page.getByRole('list', { name: 'Sessions' });
  const mine = sessions.getByRole('listitem').filter({ hasText: 'This device' });
  await expect(mine).toHaveCount(1);
  // The Desktop Chrome device announces itself as Chrome on Windows.
  await expect(mine).toContainText(/Chrome on \w+/);
});
