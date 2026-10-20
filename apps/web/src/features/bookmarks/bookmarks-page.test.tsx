import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw/http';
import { alice } from '@/test/fixtures';
import { apiError, mockDb, seedPosts, signedInAs } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';

describe('bookmarks', () => {
  it('saves a post from the feed, lists it under Bookmarks (from the account menu) and drops it when removed there', async () => {
    signedInAs(alice);
    const [newest] = seedPosts(2);
    renderApp('/');
    const user = userEvent.setup();

    const [first] = await screen.findAllByRole('article');
    if (!first) throw new Error('the feed shows no post');
    const save = within(first).getByRole('button', { name: 'Bookmark' });
    expect(save).toHaveAttribute('aria-pressed', 'false');
    await user.click(save);
    expect(save).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(mockDb.posts[0]?.bookmarkedByMe).toBe(true));

    await user.click(screen.getByRole('button', { name: /account menu/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Bookmarks' }));
    const list = await screen.findByRole('feed', { name: 'Bookmarks' });
    expect(within(list).getAllByRole('article')).toHaveLength(1);
    expect(within(list).getByText(newest?.content ?? '')).toBeInTheDocument();

    await user.click(within(list).getByRole('button', { name: 'Bookmark' }));
    expect(await screen.findByRole('heading', { name: 'Nothing saved yet' })).toBeInTheDocument();
    await waitFor(() => expect(mockDb.posts[0]?.bookmarkedByMe).toBe(false));
  });

  it('puts the bookmark back when the request fails', async () => {
    signedInAs(alice);
    seedPosts(1);
    server.use(
      http.put('*/api/v1/posts/:id/bookmark', () => apiError(500, 'INTERNAL_ERROR', 'boom')),
    );
    renderApp('/');
    const user = userEvent.setup();

    const save = await screen.findByRole('button', { name: 'Bookmark' });
    await user.click(save);
    expect(await screen.findByText('Could not update the bookmark')).toBeInTheDocument();
    await waitFor(() => expect(save).toHaveAttribute('aria-pressed', 'false'));
    expect(mockDb.posts[0]?.bookmarkedByMe).toBe(false);
  });
});
