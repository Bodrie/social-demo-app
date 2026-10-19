import path from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { contextAs, openHome } from './helpers.js';

// Both tests talk between alice and bob, so they must not interleave (fullyParallel is on).
test.describe.configure({ mode: 'default' });

test.describe('chat', () => {
  test('two members see each other online and exchange messages live', async ({
    page,
    browser,
  }) => {
    const bob = await (await contextAs(browser, 'bob')).newPage();
    await openHome(bob);
    await openHome(page);

    // Presence: alice sees Bob in the online list once both sockets are up.
    const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
    await expect(
      sidebar.getByRole('list', { name: 'Online now' }).getByText('Bob Brown'),
    ).toBeVisible();

    // Alice writes to Bob from his profile's Message button.
    await page.goto('/u/bob');
    await page.getByRole('link', { name: 'Message', exact: true }).click();
    await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}$/);
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
    // A receipt is a second browser's round trip: generous on a loaded machine.
    await expect(aliceLog.getByText(/Seen/)).toBeVisible({ timeout: 15_000 });
    const reply = `Hi Alice ${Date.now()}`;
    await bob.getByRole('textbox', { name: 'Message Alice Anderson' }).fill(reply);
    // Typing is relayed live: alice's thread header says so until the message lands.
    await expect(page.getByText('typing…', { exact: true }).first()).toBeVisible();
    await bob.keyboard.press('Enter');
    await expect(aliceLog.getByText(reply)).toBeVisible();
    await expect(page.getByText('typing…', { exact: true })).toHaveCount(0);

    await bob.context().close();
    // Bob is gone: presence updates for alice.
    await page.goto('/');
    await expect(sidebar.getByRole('list', { name: 'Online now' })).toHaveCount(0);
  });

  test('a message that arrives on another page pops up as a bubble to read and reply from', async ({
    page,
    browser,
  }) => {
    const bob = await (await contextAs(browser, 'bob')).newPage();
    await openHome(page);
    await bob.goto('/messages/with/alice');
    const text = `Bubble ${Date.now()}`;
    await bob.getByRole('textbox', { name: 'Message Alice Anderson' }).fill(text);
    await bob.keyboard.press('Enter');

    // Alice is on her feed: a bubble with the unread count, no navigation.
    const bubble = page.getByRole('button', { name: /^Open chat with Bob Brown, \d+ unread$/ });
    await expect(bubble).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await bubble.click();
    const chat = page.getByRole('dialog', { name: 'Chat with Bob Brown' });
    await expect(chat.getByText(text)).toBeVisible();
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(axe.violations, 'axe violations with a chat window open').toEqual([]);

    // Reading in the window is a read: Bob sees it. Replying works from there too.
    await expect(bob.getByText(/Seen/)).toBeVisible({ timeout: 15_000 });
    const reply = `From the bubble ${Date.now()}`;
    await chat.getByRole('textbox', { name: 'Message Bob Brown' }).fill(reply);
    await page.keyboard.press('Enter');
    await expect(
      bob.getByRole('log', { name: 'Conversation with Alice Anderson' }).getByText(reply),
    ).toBeVisible();

    await chat.getByRole('button', { name: 'Minimise chat with Bob Brown' }).click();
    await expect(chat).toBeHidden();
    await expect(page.getByRole('button', { name: 'Open chat with Bob Brown' })).toBeVisible();
    await page.getByRole('button', { name: 'Hide chat with Bob Brown' }).click();
    await expect(page.getByRole('list', { name: 'Chat bubbles' })).toHaveCount(0);
    await bob.context().close();
  });

  test('pictures travel with messages', async ({ page, browser }) => {
    const bob = await (await contextAs(browser, 'bob')).newPage();
    await openHome(bob);
    await bob.goto('/messages/with/alice');
    await openHome(page);
    await page.goto('/messages/with/bob');
    const aliceLog = page.getByRole('log', { name: 'Conversation with Bob Brown' });
    await expect(aliceLog).toBeVisible();

    await page
      .getByLabel('Attach a picture')
      .setInputFiles(path.join(import.meta.dirname, 'fixtures', 'photo.png'));
    await expect(page.getByRole('img', { name: 'Attachment preview' })).toBeVisible();
    const caption = `Look ${Date.now()}`;
    await page.getByRole('textbox', { name: 'Message Bob Brown' }).fill(caption);
    // Send waits for the upload to finish (the button is disabled until then).
    await page.getByRole('button', { name: 'Send' }).click();
    const sent = aliceLog.getByRole('listitem').filter({ hasText: caption });
    await expect(sent.getByRole('img', { name: 'Sent by you' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Attachment preview' })).toHaveCount(0);

    // Bob gets the picture pushed into his open thread.
    const bobLog = bob.getByRole('log', { name: 'Conversation with Alice Anderson' });
    const received = bobLog.getByRole('listitem').filter({ hasText: caption });
    await expect(received.getByRole('img', { name: 'Sent by Alice Anderson' })).toBeVisible();
    await bob.context().close();
  });

  test('a group reaches every member live and lists who is in it', async ({ page, browser }) => {
    const bob = await (await contextAs(browser, 'bob')).newPage();
    await openHome(bob);
    await bob.goto('/messages');
    await openHome(page);
    await page.goto('/messages');

    const title = `Trip ${Date.now()}`;
    await page
      .getByRole('complementary', { name: 'Conversations' })
      .getByRole('button', { name: 'New group' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'New group' });
    await dialog.getByLabel('Group name').fill(title);
    await dialog.getByRole('searchbox').fill('bob');
    await dialog.getByRole('button', { name: /Bob Brown/ }).click();
    await dialog.getByRole('button', { name: 'Create group' }).click();
    await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}$/);
    const log = page.getByRole('log', { name: `Group ${title}` });
    await expect(log).toBeVisible();

    // Bob's list picks the new group up without a reload, then his thread gets the message.
    const bobList = bob.getByRole('list', { name: 'Conversations' });
    const bobRow = bobList.getByRole('link', { name: new RegExp(title) });
    await expect(bobRow).toBeVisible();
    const text = `Where to? ${Date.now()}`;
    await page.getByRole('textbox', { name: `Message ${title}` }).fill(text);
    await page.keyboard.press('Enter');
    await bobRow.click();
    const bobLog = bob.getByRole('log', { name: `Group ${title}` });
    await expect(bobLog.getByText(text)).toBeVisible();
    await expect(log.getByText('Seen by everyone')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Group members' }).click();
    const members = page
      .getByRole('dialog', { name: title })
      .getByRole('list', { name: 'Members' });
    await expect(members.getByRole('listitem')).toHaveCount(2);
    await expect(members).toContainText('Alice Anderson (you)');
    await expect(members).toContainText('Bob Brown');
    await page.keyboard.press('Escape');
    await bob.context().close();
  });
});
