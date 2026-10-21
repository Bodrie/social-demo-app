import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw/http';
import { deferred } from '@/test/deferred';
import { alice, makeImage, summaryOf, testId } from '@/test/fixtures';
import { apiError, mockDb, seedPosts, signedInAs } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';

describe('PostCard', () => {
  it('reserves a single picture its proportions and opens it in the viewer', async () => {
    signedInAs(alice);
    seedPosts(1, { images: [makeImage(1, 1200, 800)] });
    renderApp('/');
    const user = userEvent.setup();

    const open = await screen.findByRole('button', { name: 'Open picture' });
    // The size from the API reserves the space before the file arrives.
    expect(open.querySelector('img')).toHaveAttribute('width', '1200');
    expect(open.querySelector('img')).toHaveAttribute('height', '800');
    await user.click(open);

    const viewer = await screen.findByRole('dialog', { name: 'Pictures posted by Bob Brown' });
    expect(within(viewer).getByRole('img', { name: 'Posted by Bob Brown' })).toHaveAttribute(
      'src',
      makeImage(1).url,
    );
    // One picture: nothing to page through.
    expect(within(viewer).queryByRole('button', { name: 'Next picture' })).not.toBeInTheDocument();
    await user.click(within(viewer).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(open).toHaveFocus());
  });

  it('pages through several pictures by button, key and swipe, round and round', async () => {
    signedInAs(alice);
    seedPosts(1, { images: [makeImage(1), makeImage(2), makeImage(3)] });
    renderApp('/');
    const user = userEvent.setup();

    const article = await screen.findByRole('article');
    expect(within(article).getAllByRole('button', { name: /^Open picture \d of 3$/ })).toHaveLength(
      3,
    );
    const second = within(article).getByRole('button', { name: 'Open picture 2 of 3' });
    await user.click(second);
    const viewer = await screen.findByRole('dialog', { name: 'Pictures posted by Bob Brown' });
    const shown = () => within(viewer).getByRole('img');
    expect(shown()).toHaveAccessibleName('Posted by Bob Brown, 2 of 3');
    expect(within(viewer).getByRole('status')).toHaveTextContent('2 of 3');

    await user.keyboard('{ArrowRight}');
    expect(shown()).toHaveAttribute('src', makeImage(3).url);
    await user.click(within(viewer).getByRole('button', { name: 'Next picture' }));
    expect(shown()).toHaveAttribute('src', makeImage(1).url);
    await user.click(within(viewer).getByRole('button', { name: 'Previous picture' }));
    expect(shown()).toHaveAttribute('src', makeImage(3).url);

    // A finger moving left shows the next one; a mouse drag does nothing.
    const stage = shown().parentElement;
    if (!stage) throw new Error('the picture has no stage');
    const touch = { pointerType: 'touch', isPrimary: true, pointerId: 7, button: 0 };
    fireEvent.pointerDown(stage, { ...touch, clientX: 300, clientY: 200 });
    fireEvent.pointerUp(stage, { ...touch, clientX: 120, clientY: 210 });
    expect(shown()).toHaveAttribute('src', makeImage(1).url);
    fireEvent.pointerDown(stage, { pointerType: 'mouse', isPrimary: true, clientX: 300 });
    fireEvent.pointerUp(stage, { pointerType: 'mouse', isPrimary: true, clientX: 100 });
    expect(shown()).toHaveAttribute('src', makeImage(1).url);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(second).toHaveFocus());
  });

  it('likes and unlikes optimistically', async () => {
    signedInAs(alice);
    seedPosts(1, { likeCount: 3 });
    renderApp('/');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Like 3' }));
    const liked = screen.getByRole('button', { name: 'Like 4' });
    expect(liked).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(mockDb.posts[0]?.likedByMe).toBe(true));

    await user.click(liked);
    expect(screen.getByRole('button', { name: 'Like 3' })).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(mockDb.posts[0]?.likedByMe).toBe(false));
  });

  it('rolls the like back when the request fails', async () => {
    signedInAs(alice);
    seedPosts(1, { likeCount: 3 });
    server.use(http.put('*/api/v1/posts/:id/like', () => apiError(500, 'INTERNAL_ERROR', 'boom')));
    renderApp('/');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Like 3' }));
    expect(await screen.findByText('Could not update the like')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Like 3' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('rolls back only the like that failed, never one made meanwhile', async () => {
    signedInAs(alice);
    const [failing, other] = seedPosts(2, { likeCount: 3 });
    const answered = deferred();
    server.use(
      http.put('*/api/v1/posts/:id/like', async ({ params }) => {
        if (params.id !== failing?.id) return undefined;
        await answered.promise;
        return apiError(500, 'INTERNAL_ERROR', 'boom');
      }),
    );
    renderApp('/');
    const user = userEvent.setup();
    const articles = await screen.findAllByRole('article');
    const cardOf = (content = '') => {
      const card = articles.find((article) => within(article).queryByText(content));
      if (!card) throw new Error(`no card for ${content}`);
      return card;
    };
    const failingCard = cardOf(failing?.content);
    const otherCard = cardOf(other?.content);

    // The first like hangs (then fails); the second one goes through meanwhile.
    await user.click(within(failingCard).getByRole('button', { name: 'Like 3' }));
    await user.click(within(otherCard).getByRole('button', { name: 'Like 3' }));
    await waitFor(() => expect(mockDb.posts.find((p) => p.id === other?.id)?.likedByMe).toBe(true));

    answered.resolve();
    expect(await screen.findByText('Could not update the like')).toBeInTheDocument();
    expect(within(failingCard).getByRole('button', { name: 'Like 3' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(within(otherCard).getByRole('button', { name: 'Like 4' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // The lists showing the failed post are refetched; the server agrees with what is shown.
    await waitFor(() =>
      expect(within(otherCard).getByRole('button', { name: 'Like 4' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
  });

  it('lets the author delete a post after confirming', async () => {
    signedInAs(alice);
    seedPosts(1, { author: summaryOf(alice), content: 'Mine' });
    seedPosts(1, { content: 'Theirs' });
    renderApp('/');
    const user = userEvent.setup();

    const articles = await screen.findAllByRole('article');
    expect(articles).toHaveLength(2);
    const mine = articles.find((article) => within(article).queryByText('Mine'));
    const theirs = articles.find((article) => within(article).queryByText('Theirs'));
    if (!mine || !theirs) throw new Error('cards not found');

    // Everyone gets a menu (copy link); only the author sees the destructive items.
    await user.click(within(theirs).getByRole('button', { name: 'Post options' }));
    expect(await screen.findByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Delete post' })).toBeNull();
    await user.keyboard('{Escape}');

    await user.click(within(mine).getByRole('button', { name: 'Post options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete post' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
    expect(screen.getByText('Theirs')).toBeInTheDocument();
    expect(mockDb.posts).toHaveLength(1);
    expect(await screen.findByText('Post deleted')).toBeInTheDocument();
  });

  it('lets the author edit the text and shows the edit history', async () => {
    signedInAs(alice);
    seedPosts(1, { author: summaryOf(alice), content: 'Frist post' });
    renderApp('/');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Post options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit post' }));
    const editor = screen.getByLabelText('Edit post');
    await user.clear(editor);
    await user.type(editor, 'First post');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const article = await screen.findByRole('article');
    expect(await within(article).findByText('First post')).toBeInTheDocument();
    expect(mockDb.posts[0]?.content).toBe('First post');
    await user.click(within(article).getByRole('button', { name: 'edited' }));
    const history = await screen.findByRole('list', { name: 'Previous versions' });
    expect(within(history).getByText('Frist post')).toBeInTheDocument();
  });

  it('loads older versions of a long edit history on demand', async () => {
    signedInAs(alice);
    const [post] = seedPosts(1, { editedAt: new Date().toISOString() });
    mockDb.postRevisions.set(
      post!.id,
      Array.from({ length: 25 }, (_, index) => ({
        id: testId('comment', 900 + index),
        content: `Version ${25 - index}`,
        editedAt: new Date(Date.now() - index * 60_000).toISOString(),
      })),
    );
    renderApp('/');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'edited' }));
    const history = await screen.findByRole('list', { name: 'Previous versions' });
    expect(within(history).getAllByRole('listitem')).toHaveLength(20);
    await user.click(screen.getByRole('button', { name: 'Show older versions' }));
    await waitFor(() => expect(within(history).getAllByRole('listitem')).toHaveLength(25));
    expect(screen.queryByRole('button', { name: 'Show older versions' })).toBeNull();
  });
});
