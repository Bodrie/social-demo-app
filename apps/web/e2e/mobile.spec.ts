import { expect, test } from '@playwright/test';
import { USERS, contextAs, openHome } from './helpers.js';

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  // Carol's conversations are shared by two tests here; keep them in order.
  test.describe.configure({ mode: 'default' });

  test('messages: empty state, new conversation, thread and back to the list', async ({
    browser,
  }) => {
    // Carol has no conversations in the seed.
    const carol = await (await contextAs(browser, 'carol')).newPage();
    await carol.setViewportSize({ width: 390, height: 844 });
    await carol.goto('/messages');
    await expect(carol.getByText('No conversations yet.')).toBeVisible();

    await carol.getByRole('button', { name: 'New message' }).click();
    const dialog = carol.getByRole('dialog', { name: 'New message' });
    await dialog.getByRole('searchbox').fill('bob');
    await dialog.getByRole('button', { name: /Bob Brown/ }).click();
    await expect(carol).toHaveURL(/\/messages\/[0-9a-f-]{36}$/);
    await expect(carol.getByRole('link', { name: 'Back to conversations' })).toBeVisible();
    const text = `Hi from a phone ${Date.now()}`;
    await carol.getByRole('textbox', { name: `Message ${USERS.bob.name}` }).fill(text);
    await carol.keyboard.press('Enter');
    await expect(
      carol.getByRole('log', { name: `Conversation with ${USERS.bob.name}` }).getByText(text),
    ).toBeVisible();

    await carol.getByRole('link', { name: 'Back to conversations' }).click();
    await expect(carol).toHaveURL(/\/messages$/);
    await expect(
      carol.getByRole('list', { name: 'Conversations' }).getByRole('listitem').first(),
    ).toContainText(text);
    await carol.context().close();
  });

  test('profile tabs and the navigation sheet', async ({ page }) => {
    await openHome(page);
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('link', { name: 'People' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'People' })).toBeVisible();
    // Below xl the suggestions sit inline on the page.
    await expect(page.getByRole('list', { name: 'Suggestions' })).toBeVisible();

    await page.goto(`/u/${USERS.bob.username}`);
    await page.getByRole('link', { name: 'Followers', exact: true }).click();
    await expect(page).toHaveURL(/\/followers$/);
    await expect(
      page.getByRole('list', { name: 'Followers' }).getByRole('listitem').first(),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Posts', exact: true }).click();
    await expect(page.getByRole('feed', { name: `Posts by ${USERS.bob.name}` })).toBeVisible();
  });

  test('a new message shows a bubble row at the top and opens as a full-width panel', async ({
    page,
    browser,
  }) => {
    // Carol on her phone, alice writing to her from the desktop.
    const carol = await (await contextAs(browser, 'carol')).newPage();
    await carol.setViewportSize({ width: 390, height: 844 });
    await openHome(carol);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/messages/with/carol');
    const text = `For your phone ${Date.now()}`;
    await page.getByRole('textbox', { name: `Message ${USERS.carol.name}` }).fill(text);
    await page.keyboard.press('Enter');

    const row = carol.getByRole('list', { name: 'Chat bubbles' });
    const bubble = row.getByRole('button', { name: /Open chat with Alice Anderson/ });
    await expect(bubble).toBeVisible();
    await bubble.click();
    const panel = carol.getByRole('dialog', { name: 'Chat with Alice Anderson' });
    await expect(panel.getByText(text)).toBeVisible();
    await panel.getByRole('button', { name: 'Minimise chat with Alice Anderson' }).click();
    await expect(panel).toBeHidden();
    await expect(bubble).toBeVisible();
    await carol.context().close();
  });
});
