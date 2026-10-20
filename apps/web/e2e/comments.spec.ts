import { expect, test } from '@playwright/test';
import { contextAs, openHome } from './helpers.js';

test.describe('editing and reactions', () => {
  test('edit a post, keep its history, react to a comment, sort by top, edit the comment', async ({
    page,
    browser,
  }) => {
    await openHome(page);
    const text = `Editable ${Date.now()}`;
    await page.getByLabel('New post').fill(text);
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    const post = page.getByRole('article').filter({ hasText: text }).first();
    await expect(post).toBeVisible();

    // Edit the post; the old text is one click away.
    await post.getByRole('button', { name: 'Post options' }).click();
    await page.getByRole('menuitem', { name: 'Edit post' }).click();
    await post.getByLabel('Edit post').fill(`${text} (edited)`);
    await post.getByRole('button', { name: 'Save' }).click();
    await expect(post.getByText(`${text} (edited)`)).toBeVisible();
    await post.getByRole('button', { name: 'edited' }).click();
    await expect(
      page.getByRole('list', { name: 'Previous versions' }).getByText(text),
    ).toBeVisible();
    await page.keyboard.press('Escape');

    // Bob comments first (comments do not refresh live), then Alice opens the thread and adds
    // hers. Bob's older comment gets the reactions, so "Top" puts it first.
    const bob = await (await contextAs(browser, 'bob')).newPage();
    await openHome(bob);
    const bobPost = bob.getByRole('article').filter({ hasText: text }).first();
    await bobPost.getByRole('button', { name: /^Comments/ }).click();
    await bobPost.getByLabel('Write a comment').fill('Bob first');
    await bobPost.getByRole('button', { name: 'Send comment' }).click();
    await expect(bobPost.getByText('Bob first')).toBeVisible();

    await post.getByRole('button', { name: /^Comments/ }).click();
    const comments = post.getByRole('region', { name: 'Comments' });
    await expect(comments.getByText('Bob first')).toBeVisible();
    await post.getByLabel('Write a comment').fill('Alice second');
    await post.getByRole('button', { name: 'Send comment' }).click();
    await expect(comments.getByText('Alice second')).toBeVisible();

    const bobComment = comments.getByRole('listitem').filter({ hasText: 'Bob first' });
    await bobComment.getByRole('button', { name: 'Add reaction' }).click();
    // The pill is optimistic: "Top" must not be fetched before the reaction is stored.
    const saved = page.waitForResponse(
      (res) => res.url().endsWith('/reaction') && res.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Love' }).click();
    expect((await saved).ok()).toBe(true);
    await expect(bobComment.getByRole('button', { name: 'Love 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await comments.getByRole('button', { name: 'Top' }).click();
    await expect(comments.getByRole('listitem').first()).toContainText('Bob first');
    await comments.getByRole('button', { name: 'Newest' }).click();
    await expect(comments.getByRole('listitem').first()).toContainText('Alice second');

    // Edit the own comment and check the history.
    const mine = comments.getByRole('listitem').filter({ hasText: 'Alice second' });
    await mine.getByRole('button', { name: 'Comment options' }).click();
    await page.getByRole('menuitem', { name: 'Edit comment' }).click();
    await mine.getByLabel('Edit comment').fill('Alice second, revised');
    await mine.getByLabel('Edit comment').press('Enter');
    await expect(mine.getByText('Alice second, revised')).toBeVisible();
    await mine.getByRole('button', { name: 'edited' }).click();
    await expect(
      page.getByRole('list', { name: 'Previous versions' }).getByText('Alice second'),
    ).toBeVisible();
    await page.keyboard.press('Escape');

    // Clean up.
    await post.getByRole('button', { name: 'Post options' }).click();
    await page.getByRole('menuitem', { name: 'Delete post' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('article').filter({ hasText: text })).toHaveCount(0);
    await bob.context().close();
  });
  test('reply to a comment, answer a reply by name, fold the thread', async ({ page, browser }) => {
    await openHome(page);
    const text = `Threaded ${Date.now()}`;
    await page.getByLabel('New post').fill(text);
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    const post = page.getByRole('article').filter({ hasText: text }).first();
    await expect(post).toBeVisible();

    // Bob asks; Alice answers under his comment.
    const bob = await (await contextAs(browser, 'bob')).newPage();
    await openHome(bob);
    const bobPost = bob.getByRole('article').filter({ hasText: text }).first();
    await bobPost.getByRole('button', { name: /^Comments/ }).click();
    await bobPost.getByLabel('Write a comment').fill('Bob asks');
    await bobPost.getByRole('button', { name: 'Send comment' }).click();
    await expect(bobPost.getByText('Bob asks')).toBeVisible();

    await post.getByRole('button', { name: /^Comments/ }).click();
    const comments = post.getByRole('region', { name: 'Comments' });
    const bobComment = comments.getByRole('listitem').filter({ hasText: 'Bob asks' }).first();
    await bobComment.getByRole('button', { name: 'Reply', exact: true }).first().click();
    await comments.getByLabel('Write a reply').fill('Alice answers');
    await comments.getByLabel('Write a reply').press('Enter');
    await expect(bobComment.getByRole('list', { name: 'Replies' })).toContainText('Alice answers');

    // Bob finds the thread folded (his card counts both comments), opens it and answers Alice
    // by name.
    await bob.reload();
    const bobPostAgain = bob.getByRole('article').filter({ hasText: text }).first();
    await bobPostAgain.getByRole('button', { name: 'Comments 2' }).click();
    const bobComments = bobPostAgain.getByRole('region', { name: 'Comments' });
    await bobComments.getByRole('button', { name: 'View 1 reply' }).click();
    const bobReplies = bobComments.getByRole('list', { name: 'Replies' });
    await bobReplies
      .getByRole('listitem')
      .filter({ hasText: 'Alice answers' })
      .getByRole('button', { name: 'Reply', exact: true })
      .click();
    await expect(bobComments.getByLabel('Write a reply')).toHaveValue('@alice ');
    await bobComments.getByLabel('Write a reply').press('End');
    await bobComments.getByLabel('Write a reply').pressSequentially('thanks');
    await bobComments.getByLabel('Write a reply').press('Enter');
    await expect(bobReplies).toContainText('@alice thanks');
    await bobComments.getByRole('button', { name: 'Hide replies' }).click();
    await expect(bobComments.getByRole('button', { name: 'View 2 replies' })).toBeVisible();

    // Clean up.
    await post.getByRole('button', { name: 'Post options' }).click();
    await page.getByRole('menuitem', { name: 'Delete post' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('article').filter({ hasText: text })).toHaveCount(0);
    await bob.context().close();
  });
});
