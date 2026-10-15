import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice, makeComment, summaryOf } from '@/test/fixtures';
import { mockDb, seedPosts, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

describe('CommentsSection', () => {
  it('opens on demand, adds with Enter and keeps the count in step', async () => {
    signedInAs(alice);
    const [post] = seedPosts(1, { commentCount: 1 });
    mockDb.comments.push(makeComment(post!.id, { content: 'Existing comment' }));
    renderApp('/');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Comments 1' }));
    const section = await screen.findByRole('region', { name: 'Comments' });
    expect(await within(section).findByText('Existing comment')).toBeInTheDocument();

    await user.type(within(section).getByLabelText('Write a comment'), 'Hello there{Enter}');
    expect(await within(section).findByText('Hello there')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comments 2' })).toBeInTheDocument();
    expect(within(section).getByLabelText('Write a comment')).toHaveValue('');
    // The newest comment is listed first.
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
    expect(
      within(theirSection).queryByRole('button', { name: 'Delete comment' }),
    ).not.toBeInTheDocument();

    await user.click(onMine!);
    const sections = await screen.findAllByRole('region', { name: 'Comments' });
    const mySection = sections[0]!;
    expect(await within(mySection).findByText('On my post')).toBeInTheDocument();
    await user.click(within(mySection).getByRole('button', { name: 'Delete comment' }));
    await waitFor(() =>
      expect(within(mySection).queryByText('On my post')).not.toBeInTheDocument(),
    );
    expect(
      within(mySection).getByText('No comments yet. Start the conversation.'),
    ).toBeInTheDocument();
    expect(mockDb.comments).toHaveLength(1);
  });
});
