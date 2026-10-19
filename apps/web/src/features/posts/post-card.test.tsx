import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw/http';
import { deferred } from '@/test/deferred';
import { alice, summaryOf } from '@/test/fixtures';
import { apiError, mockDb, seedPosts, signedInAs } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';

describe('PostCard', () => {
  it('likes and unlikes optimistically', async () => {
    signedInAs(alice);
    seedPosts(1, { likeCount: 3 });
    renderApp('/');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Like 3' }));
    const unlike = screen.getByRole('button', { name: 'Unlike 4' });
    expect(unlike).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(mockDb.posts[0]?.likedByMe).toBe(true));

    await user.click(unlike);
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
    expect(within(failingCard).getByRole('button', { name: 'Like 3' })).toBeInTheDocument();
    expect(within(otherCard).getByRole('button', { name: 'Unlike 4' })).toBeInTheDocument();
    // The lists showing the failed post are refetched; the server agrees with what is shown.
    await waitFor(() =>
      expect(within(otherCard).getByRole('button', { name: 'Unlike 4' })).toBeInTheDocument(),
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
});
