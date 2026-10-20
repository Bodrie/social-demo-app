import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice, bob, carol, makeComment, summaryOf } from '@/test/fixtures';
import { mockDb, seedPosts, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

async function openComments(name: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name }));
  return { user, section: await screen.findByRole('region', { name: 'Comments' }) };
}

describe('CommentsSection', () => {
  it('opens on demand, adds with Enter and keeps the count in step', async () => {
    signedInAs(alice);
    const [post] = seedPosts(1, { commentCount: 1 });
    mockDb.comments.push(makeComment(post!.id, { content: 'Existing comment' }));
    renderApp('/');
    const { user, section } = await openComments('Comments 1');
    expect(await within(section).findByText('Existing comment')).toBeInTheDocument();

    await user.type(within(section).getByLabelText('Write a comment'), 'Hello there{Enter}');
    expect(await within(section).findByText('Hello there')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comments 2' })).toBeInTheDocument();
    expect(within(section).getByLabelText('Write a comment')).toHaveValue('');
    const texts = within(section)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(texts[0]).toContain('Hello there');
  });

  it("lets the post author delete anyone's comment, and others only their own", async () => {
    signedInAs(alice);
    const [mine, theirs] = seedPosts(2, { commentCount: 1 });
    mockDb.posts[0]!.author = summaryOf(alice);
    mockDb.comments.push(makeComment(mine!.id, { content: 'On my post' }));
    mockDb.comments.push(makeComment(theirs!.id, { content: 'On their post' }));
    renderApp('/');
    const user = userEvent.setup();

    const [onMine, onTheirs] = await screen.findAllByRole('button', { name: 'Comments 1' });
    await user.click(onTheirs!);
    const theirSection = await screen.findByRole('region', { name: 'Comments' });
    expect(await within(theirSection).findByText('On their post')).toBeInTheDocument();
    // Someone else's comment on someone else's post: the menu only offers to report it.
    await user.click(within(theirSection).getByRole('button', { name: 'Comment options' }));
    expect(await screen.findByRole('menuitem', { name: 'Report comment' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Delete comment' })).toBeNull();
    await user.keyboard('{Escape}');

    await user.click(onMine!);
    const mySection = (await screen.findAllByRole('region', { name: 'Comments' }))[0]!;
    expect(await within(mySection).findByText('On my post')).toBeInTheDocument();
    await user.click(within(mySection).getByRole('button', { name: 'Comment options' }));
    expect(screen.queryByRole('menuitem', { name: 'Edit comment' })).toBeNull();
    await user.click(await screen.findByRole('menuitem', { name: 'Delete comment' }));
    await waitFor(() => expect(within(mySection).queryByText('On my post')).toBeNull());
    expect(mockDb.comments).toHaveLength(1);
  });

  it('edits an own comment, marks it edited and shows the previous version', async () => {
    signedInAs(alice);
    const [post] = seedPosts(1, { commentCount: 1 });
    mockDb.comments.push(makeComment(post!.id, { content: 'Typo here', author: summaryOf(alice) }));
    renderApp('/');
    const { user, section } = await openComments('Comments 1');
    await within(section).findByText('Typo here');

    await user.click(within(section).getByRole('button', { name: 'Comment options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit comment' }));
    const editor = within(section).getByLabelText('Edit comment');
    await user.clear(editor);
    await user.type(editor, 'Fixed now{Enter}');

    expect(await within(section).findByText('Fixed now')).toBeInTheDocument();
    expect(within(section).queryByLabelText('Edit comment')).toBeNull();
    await user.click(within(section).getByRole('button', { name: 'edited' }));
    const history = await screen.findByRole('list', { name: 'Previous versions' });
    expect(within(history).getByText('Typo here')).toBeInTheDocument();
    expect(mockDb.comments[0]).toMatchObject({ content: 'Fixed now' });
  });

  it('reacts, switches and removes a reaction with live counts', async () => {
    signedInAs(alice);
    const [post] = seedPosts(1, { commentCount: 1 });
    const comment = makeComment(post!.id, { content: 'React to me' });
    mockDb.comments.push(comment);
    mockDb.reactions.push({ commentId: comment.id, userId: bob.id, type: 'LIKE' });
    renderApp('/');
    const { user, section } = await openComments('Comments 1');
    await within(section).findByText('React to me');
    expect(within(section).getByRole('button', { name: 'Like 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await user.click(within(section).getByRole('button', { name: 'Add reaction' }));
    await user.click(await screen.findByRole('button', { name: 'Love' }));
    expect(await within(section).findByRole('button', { name: 'Love 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await waitFor(() => expect(mockDb.reactions).toHaveLength(2));

    // Clicking the Like pill switches my reaction over.
    await user.click(within(section).getByRole('button', { name: 'Like 1' }));
    expect(await within(section).findByRole('button', { name: 'Like 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(section).queryByRole('button', { name: /^Love/ })).toBeNull();

    // Clicking my own pill removes it.
    await user.click(within(section).getByRole('button', { name: 'Like 2' }));
    expect(await within(section).findByRole('button', { name: 'Like 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await waitFor(() => expect(mockDb.reactions).toHaveLength(1));
  });

  it('sorts by most reactions on request', async () => {
    signedInAs(alice);
    const [post] = seedPosts(1, { commentCount: 2 });
    const older = makeComment(post!.id, { content: 'Popular but older' });
    const newer = makeComment(post!.id, { content: 'Newer, no reactions' });
    mockDb.comments.push(newer, older);
    mockDb.reactions.push(
      { commentId: older.id, userId: bob.id, type: 'LAUGH' },
      { commentId: older.id, userId: carol.id, type: 'WOW' },
    );
    renderApp('/');
    const { user, section } = await openComments('Comments 2');
    await within(section).findByText('Popular but older');
    const order = () =>
      within(section)
        .getAllByRole('listitem')
        .map((item) => item.textContent ?? '');
    expect(order()[0]).toContain('Newer, no reactions');

    await user.click(within(section).getByRole('button', { name: 'Top' }));
    await waitFor(() => expect(order()[0]).toContain('Popular but older'));
    expect(within(section).getByRole('button', { name: 'Top' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
