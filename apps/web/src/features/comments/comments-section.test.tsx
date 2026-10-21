import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice, bob, carol, makeComment, summaryOf } from '@/test/fixtures';
import { mockDb, seedPosts, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

async function openComments(name: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name }));
  return { user, section: await screen.findByRole('region', { name: 'Comments' }) };
}

/** A finger landing on an element, the start of a press-and-hold. */
const hold = (element: HTMLElement) =>
  fireEvent.pointerDown(element, {
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    clientX: 5,
    clientY: 5,
  });

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

  it('a held comment offers reactions and its options', async () => {
    signedInAs(alice);
    const [post] = seedPosts(1, { commentCount: 2 });
    mockDb.comments.push(
      makeComment(post!.id, { content: 'Theirs to report' }),
      makeComment(post!.id, { content: 'Mine to edit', author: summaryOf(alice) }),
    );
    renderApp('/');
    const { user, section } = await openComments('Comments 2');

    const theirs = await within(section).findByText('Theirs to report');
    hold(theirs);
    expect(await screen.findByRole('button', { name: 'Report comment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Love' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit comment' })).toBeNull();
    fireEvent.pointerUp(theirs);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Love' })).toBeNull());

    const mine = within(section).getByText('Mine to edit');
    hold(mine);
    expect(await screen.findByRole('button', { name: 'Delete comment' })).toBeInTheDocument();
    fireEvent.pointerUp(mine);
    await user.click(screen.getByRole('button', { name: 'Edit comment' }));
    expect(
      await within(section).findByRole('textbox', { name: 'Edit comment' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Love' })).toBeNull();
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
  it('folds replies under a comment, unfolds them oldest first and answers in context', async () => {
    signedInAs(alice);
    const [post] = seedPosts(1, { commentCount: 3 });
    const parent = makeComment(post!.id, { content: 'Top comment' });
    mockDb.comments.push(
      parent,
      makeComment(post!.id, {
        parentId: parent.id,
        content: 'Carol answers',
        author: summaryOf(carol),
        createdAt: '2026-10-01T10:00:00.000Z',
      }),
      makeComment(post!.id, {
        parentId: parent.id,
        content: 'Bob again',
        createdAt: '2026-10-01T11:00:00.000Z',
      }),
    );
    renderApp('/');
    const { user, section } = await openComments('Comments 3');
    const thread = (await within(section).findByText('Top comment')).closest('li')!;
    expect(within(section).queryByRole('list', { name: 'Replies' })).toBeNull();

    await user.click(within(thread).getByRole('button', { name: 'View 2 replies' }));
    const replies = await within(thread).findByRole('list', { name: 'Replies' });
    expect(
      within(replies)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([expect.stringContaining('Carol answers'), expect.stringContaining('Bob again')]);

    // Answering a reply names its author and lands at the end of the thread.
    const carols = within(replies).getAllByRole('listitem')[0]!;
    await user.click(within(carols).getByRole('button', { name: 'Reply' }));
    const composer = within(thread).getByLabelText('Write a reply');
    expect(composer).toHaveValue('@carol ');
    expect(composer).toHaveFocus();
    await user.type(composer, 'agreed{Enter}');
    await waitFor(() => expect(within(replies).getAllByRole('listitem')).toHaveLength(3));
    expect(within(replies).getAllByRole('listitem')[2]).toHaveTextContent('@carol agreed');
    expect(within(thread).queryByLabelText('Write a reply')).toBeNull();
    expect(screen.getByRole('button', { name: 'Comments 4' })).toBeInTheDocument();
    expect(mockDb.comments.find((c) => c.content === '@carol agreed')).toMatchObject({
      parentId: parent.id,
    });

    await user.click(within(thread).getByRole('button', { name: 'Hide replies' }));
    expect(within(thread).queryByRole('list', { name: 'Replies' })).toBeNull();
    expect(within(thread).getByRole('button', { name: 'View 3 replies' })).toBeInTheDocument();
  });

  it('answers the comment itself from an empty composer, which Escape puts away', async () => {
    signedInAs(alice);
    const [post] = seedPosts(1, { commentCount: 1 });
    mockDb.comments.push(makeComment(post!.id, { content: 'Lonely comment' }));
    renderApp('/');
    const { user, section } = await openComments('Comments 1');
    await within(section).findByText('Lonely comment');

    const replyButton = within(section).getByRole('button', { name: 'Reply' });
    await user.click(replyButton);
    expect(within(section).getByLabelText('Write a reply')).toHaveValue('');
    await user.keyboard('{Escape}');
    expect(within(section).queryByLabelText('Write a reply')).toBeNull();
    await waitFor(() => expect(replyButton).toHaveFocus());

    // Sent, the first reply opens the thread under its comment.
    await user.click(replyButton);
    await user.type(within(section).getByLabelText('Write a reply'), 'First!{Enter}');
    const replies = await within(section).findByRole('list', { name: 'Replies' });
    expect(within(replies).getByText('First!')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Hide replies' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comments 2' })).toBeInTheDocument();
  });

  it('deleting a comment takes its replies and their count with it', async () => {
    signedInAs(alice);
    const [post] = seedPosts(1, { commentCount: 3 });
    mockDb.posts[0]!.author = summaryOf(alice);
    const parent = makeComment(post!.id, { content: 'Parent' });
    mockDb.comments.push(
      parent,
      makeComment(post!.id, { parentId: parent.id, content: 'Child one' }),
      makeComment(post!.id, { parentId: parent.id, content: 'Child two' }),
    );
    renderApp('/');
    const { user, section } = await openComments('Comments 3');
    await within(section).findByText('Parent');

    await user.click(within(section).getByRole('button', { name: 'Comment options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete comment' }));
    await waitFor(() => expect(within(section).queryByText('Parent')).toBeNull());
    expect(screen.getByRole('button', { name: 'Comments 0' })).toBeInTheDocument();
    expect(mockDb.comments).toHaveLength(0);
  });

  it('opens the thread of a permalinked reply and rings it', async () => {
    signedInAs(alice);
    const [post] = seedPosts(1, { commentCount: 2 });
    const parent = makeComment(post!.id, { content: 'Parent of the link' });
    const reply = makeComment(post!.id, { parentId: parent.id, content: 'The linked reply' });
    mockDb.comments.push(parent, reply);
    renderApp(`/p/${post!.id}?comment=${reply.id}`);

    const linked = await screen.findByText('The linked reply');
    expect(linked.closest('li')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByRole('list', { name: 'Replies' })).toBeInTheDocument();
    expect(screen.getByText('Parent of the link')).toBeInTheDocument();
  });

  it('opens the reaction picker over a comment held with a finger', async () => {
    signedInAs(alice);
    const [post] = seedPosts(1, { commentCount: 1 });
    mockDb.comments.push(makeComment(post!.id, { content: 'Hold me' }));
    renderApp('/');
    const { user, section } = await openComments('Comments 1');
    const text = await within(section).findByText('Hold me');

    fireEvent.pointerDown(text, {
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      clientX: 5,
      clientY: 5,
    });
    const love = await screen.findByRole('button', { name: 'Love' });
    fireEvent.pointerUp(text);
    await user.click(love);
    expect(await within(section).findByRole('button', { name: 'Love 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('button', { name: 'Love' })).toBeNull();
    await waitFor(() => expect(mockDb.reactions).toHaveLength(1));
  });
});
