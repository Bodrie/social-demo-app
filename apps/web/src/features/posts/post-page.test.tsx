import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice, makeComment, summaryOf, testId } from '@/test/fixtures';
import { mockDb, seedPosts, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

describe('PostPage', () => {
  it('shows the post with its comments open and names the page after the author', async () => {
    signedInAs(alice);
    const [post] = seedPosts(1, { content: 'Permalinked post', commentCount: 1 });
    mockDb.comments.push(makeComment(post!.id, { content: 'A comment on it' }));
    renderApp(`/p/${post!.id}`);

    const article = await screen.findByRole('article', { name: 'Bob Brown' });
    expect(article).toHaveTextContent('Permalinked post');
    const comments = await within(article).findByRole('region', { name: 'Comments' });
    expect(await within(comments).findByText('A comment on it')).toBeInTheDocument();
    expect(within(article).queryByRole('button', { name: /^Comments/ })).toBeNull();
    expect(document.title).toBe('Post by Bob Brown · The Mesh');
  });

  it('explains a missing post and refuses a malformed id', async () => {
    signedInAs(alice);
    const { unmount } = renderApp(`/p/${testId('post', 999)}`);
    expect(await screen.findByRole('heading', { name: 'This post is gone' })).toBeInTheDocument();
    unmount();

    renderApp('/p/not-a-uuid');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('likes from the page and lets anyone copy the link', async () => {
    signedInAs(alice);
    const [post] = seedPosts(1, { likeCount: 2 });
    renderApp(`/p/${post!.id}`);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Like 2' }));
    expect(screen.getByRole('button', { name: 'Like 3' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(mockDb.posts[0]?.likedByMe).toBe(true));

    // user-event's clipboard stub reads back through jsdom's FileReader, which refuses the Node
    // Blob the test setup installs for MSW; observing the write is enough.
    const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.click(screen.getByRole('button', { name: 'Post options' }));
    expect(screen.queryByRole('menuitem', { name: 'Delete post' })).toBeNull();
    await user.click(await screen.findByRole('menuitem', { name: 'Copy link' }));
    expect(await screen.findByText('Link copied')).toBeInTheDocument();
    expect(write).toHaveBeenCalledWith(`${window.location.origin}/p/${post!.id}`);
  });

  it('rings the comment from the address, fetching it alone when it is past the first page', async () => {
    signedInAs(alice);
    const [post] = seedPosts(1, { author: summaryOf(alice), commentCount: 22 });
    const comments = Array.from({ length: 22 }, (_, index) =>
      makeComment(post!.id, { content: `Comment ${index + 1}` }),
    );
    mockDb.comments.push(...comments);
    const onFirstPage = comments[0]!;
    const older = comments.at(-1)!;

    const { unmount } = renderApp(`/p/${post!.id}?comment=${onFirstPage.id}`);
    const first = await screen.findByText('Comment 1');
    expect(first.closest('li')).toHaveAttribute('data-highlighted', 'true');
    unmount();

    renderApp(`/p/${post!.id}?comment=${older.id}`);
    const fetched = await screen.findByText('Comment 22');
    expect(fetched.closest('li')).toHaveAttribute('data-highlighted', 'true');
    const section = await screen.findByRole('region', { name: 'Comments' });
    expect(within(section).getAllByRole('listitem')[0]).toHaveTextContent('Comment 22');
  });

  it('keeps the comment sort in the address', async () => {
    signedInAs(alice);
    const [post] = seedPosts(1, { commentCount: 2 });
    mockDb.comments.push(makeComment(post!.id), makeComment(post!.id));
    renderApp(`/p/${post!.id}`);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Top' }));
    expect(screen.getByRole('button', { name: 'Top' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(window.location.search).toBe(''));
  });

  it('links the timestamp of every card to the post page', async () => {
    signedInAs(alice);
    const [post] = seedPosts(1);
    renderApp('/');
    const article = await screen.findByRole('article');
    const permalink = within(article)
      .getAllByRole('link')
      .find((link) => link.getAttribute('href') === `/p/${post!.id}`);
    expect(permalink).toBeDefined();
  });
});
