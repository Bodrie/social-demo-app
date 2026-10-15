import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw/http';
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

  it('lets the author delete a post after confirming', async () => {
    signedInAs(alice);
    seedPosts(1, { author: summaryOf(alice), content: 'Mine' });
    seedPosts(1, { content: 'Theirs' });
    renderApp('/');
    const user = userEvent.setup();

    expect(await screen.findAllByRole('article')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Post options' })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Post options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete post' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
    expect(screen.getByText('Theirs')).toBeInTheDocument();
    expect(mockDb.posts).toHaveLength(1);
    expect(await screen.findByText('Post deleted')).toBeInTheDocument();
  });
});
