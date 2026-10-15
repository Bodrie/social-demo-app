import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw/http';
import { alice, bob, carol, summaryOf } from '@/test/fixtures';
import { apiError, mockDb, seedFollow, seedPosts, signedInAs } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';

describe('ProfilePage', () => {
  it("shows another member's profile and follows them optimistically", async () => {
    signedInAs(alice);
    seedFollow(carol.id, bob.id);
    seedFollow(bob.id, alice.id);
    renderApp('/u/bob');
    const user = userEvent.setup();

    expect(await screen.findByRole('heading', { level: 1, name: 'Bob Brown' })).toBeInTheDocument();
    expect(screen.getByText('Follows you')).toBeInTheDocument();
    expect(screen.getByText('Plovdiv')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '1 Followers' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '1 Following' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Follow' }));
    expect(screen.getByRole('button', { name: 'Following' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('link', { name: '2 Followers' })).toBeInTheDocument();
    await waitFor(() =>
      expect(mockDb.follows).toContainEqual({ followerId: alice.id, followingId: bob.id }),
    );

    await user.click(screen.getByRole('button', { name: 'Following' }));
    expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '1 Followers' })).toBeInTheDocument();
  });

  it('rolls a failed follow back', async () => {
    signedInAs(alice);
    server.use(
      http.put('*/api/v1/users/:id/follow', () => apiError(500, 'INTERNAL_ERROR', 'boom')),
    );
    renderApp('/u/bob');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Follow' }));
    expect(await screen.findByText('Could not update the follow')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '0 Followers' })).toBeInTheDocument();
  });

  it('offers editing instead of following on the own profile', async () => {
    signedInAs(alice);
    renderApp('/u/alice');
    expect(await screen.findByRole('button', { name: 'Edit profile' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Follow' })).not.toBeInTheDocument();
  });

  it('explains an unknown username', async () => {
    signedInAs(alice);
    renderApp('/u/nobody');
    expect(
      await screen.findByRole('heading', { name: "This profile doesn't exist" }),
    ).toBeInTheDocument();
  });

  it("lists only the member's own posts, then followers and following via the tabs", async () => {
    signedInAs(alice);
    seedPosts(2, { author: summaryOf(bob), content: 'By Bob' });
    seedPosts(1, { author: summaryOf(carol), content: 'By Carol' });
    seedFollow(carol.id, bob.id);
    seedFollow(bob.id, alice.id);
    renderApp('/u/bob');
    const user = userEvent.setup();

    const feed = await screen.findByRole('feed', { name: 'Posts by Bob Brown' });
    expect(within(feed).getAllByRole('article')).toHaveLength(2);
    expect(screen.queryByText('By Carol')).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Followers' }));
    const followers = await screen.findByRole('list', { name: 'Followers' });
    expect(within(followers).getByRole('link', { name: 'Carol Clark' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Following' }));
    const following = await screen.findByRole('list', { name: 'Following' });
    expect(within(following).getByRole('link', { name: 'Alice Anderson' })).toBeInTheDocument();
    // The viewer never gets a follow button for themselves.
    expect(within(following).queryByRole('button', { name: /Follow/ })).not.toBeInTheDocument();
  });
});
