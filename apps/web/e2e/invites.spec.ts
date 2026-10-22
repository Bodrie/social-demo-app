import { expect, test } from '@playwright/test';
import { ANONYMOUS, USERS, contextAs, registerAndConfirm } from './helpers.js';

test.describe('invites', () => {
  test.use({ storageState: ANONYMOUS });

  test('a visitor joins through alice’s link and starts out following her; alice is told', async ({
    page,
    browser,
  }) => {
    // The seed gives alice the link /join/welcome-from-alice.
    await page.goto('/join/welcome-from-alice');
    await expect(
      page.getByRole('heading', { name: `${USERS.alice.name} invited you to BeSo` }),
    ).toBeVisible();
    const member = await registerAndConfirm(page, { from: '/join/welcome-from-alice' });

    await page.goto(`/u/${member.username}/following`);
    await expect(
      page.getByRole('list', { name: 'Following' }).getByRole('link', { name: USERS.alice.name }),
    ).toBeVisible();

    const alice = await (await contextAs(browser, 'alice')).newPage();
    await alice.goto('/notifications');
    const notice = alice
      .getByRole('list', { name: 'Notifications' })
      .getByRole('listitem')
      .filter({ hasText: member.name })
      .first();
    await expect(notice).toContainText('accepted your invite and follows you');
    await notice.getByRole('button', { name: 'Follow back' }).click();
    await expect(notice.getByRole('button', { name: 'Following' })).toBeVisible();
    await alice.context().close();
  });
});
