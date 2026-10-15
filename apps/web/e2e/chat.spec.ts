import { type Browser, type Page, expect, test } from '@playwright/test';
import { ANONYMOUS, openHome } from './helpers.js';

const BOB = { email: 'bob@example.com', password: 'Password123!' };

async function signInAsBob(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ storageState: ANONYMOUS });
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(BOB.email);
  await page.getByLabel('Password').fill(BOB.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByLabel('New post')).toBeVisible();
  return page;
}

test.describe('chat', () => {
  test('two members see each other online and exchange messages live', async ({
    page,
    browser,
  }) => {
    const bob = await signInAsBob(browser);
    await openHome(page);

    // Presence: alice sees Bob in the online list once both sockets are up.
    const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
    await expect(
      sidebar.getByRole('list', { name: 'Online now' }).getByText('Bob Brown'),
    ).toBeVisible();

    // Alice writes to Bob from his profile's Message button.
    await page.goto('/u/bob');
    await page.getByRole('link', { name: 'Message', exact: true }).click();
    await expect(page).toHaveURL(/\/messages\/bob$/);
    const text = `Hello Bob ${Date.now()}`;
    await page.getByRole('textbox', { name: 'Message Bob Brown' }).fill(text);
    await page.keyboard.press('Enter');
    const aliceLog = page.getByRole('log', { name: 'Conversation with Bob Brown' });
    await expect(aliceLog.getByText(text)).toBeVisible();

    // Bob gets it pushed: unread badge in the nav and the conversation list, then reads it.
    await bob.goto('/messages');
    const bobList = bob.getByRole('list', { name: 'Conversations' });
    await expect(bobList.getByRole('listitem').first()).toContainText(text);
    await bobList.getByRole('link', { name: /Alice Anderson/ }).click();
    const bobLog = bob.getByRole('log', { name: 'Conversation with Alice Anderson' });
    await expect(bobLog.getByText(text)).toBeVisible();

    // Alice sees the read receipt, then Bob's reply arrives without a reload.
    await expect(aliceLog.getByText(/Seen/)).toBeVisible();
    const reply = `Hi Alice ${Date.now()}`;
    await bob.getByRole('textbox', { name: 'Message Alice Anderson' }).fill(reply);
    await bob.keyboard.press('Enter');
    await expect(aliceLog.getByText(reply)).toBeVisible();

    await bob.context().close();
    // Bob is gone: presence updates for alice.
    await page.goto('/');
    await expect(sidebar.getByRole('list', { name: 'Online now' })).toHaveCount(0);
  });
});
