import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { animationsDone, contextAs, openHome } from './helpers.js';

test.describe('polls', () => {
  test('alice asks, bob votes once, and both see the result', async ({ page, browser }) => {
    await openHome(page);
    const question = `Which day for the hike? ${Date.now()}`;

    await page.getByRole('button', { name: 'Poll', exact: true }).click();
    await page.getByRole('textbox', { name: 'Option 1' }).fill('Saturday');
    await page.getByRole('textbox', { name: 'Option 2' }).fill('Sunday');
    await page.getByLabel('Open for').selectOption('1 hour');
    await page.getByLabel('New post').fill(question);
    await animationsDone(page);
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(axe.violations, 'axe violations with the poll editor open').toEqual([]);
    await page.getByRole('button', { name: 'Post', exact: true }).click();

    const mine = page.getByRole('article').filter({ hasText: question }).first();
    await expect(mine.getByRole('list', { name: 'Poll results' })).toBeVisible();
    await expect(mine).toContainText('0 votes · 1 hour left');
    await mine.getByRole('link', { name: /open post$/ }).click();
    await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/);
    const postUrl = page.url();

    const bob = await (await contextAs(browser, 'bob')).newPage();
    await bob.goto(postUrl);
    const theirs = bob.getByRole('article').filter({ hasText: question }).first();
    await expect(theirs).toContainText('0 votes');
    await theirs.getByRole('button', { name: 'Vote for Sunday' }).click();
    const results = theirs.getByRole('list', { name: 'Poll results' });
    await expect(results.getByRole('listitem').filter({ hasText: 'your vote' })).toContainText(
      'Sunday',
    );
    await expect(theirs).toContainText('1 vote · ');
    await expect(theirs.getByRole('button', { name: /^Vote for/ })).toHaveCount(0);

    await page.reload();
    const again = page.getByRole('article').filter({ hasText: question }).first();
    await expect(again.getByRole('list', { name: 'Poll results' })).toContainText('100 %');
    await expect(again).toContainText('1 vote · ');

    // Leave the feeds as the other specs expect them.
    await again.getByRole('button', { name: 'Post options' }).click();
    await page.getByRole('menuitem', { name: 'Delete post' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('article').filter({ hasText: question })).toHaveCount(0);
    await bob.context().close();
  });
});
