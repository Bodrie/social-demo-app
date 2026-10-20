import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice, bob } from '@/test/fixtures';
import { mockDb, seedFollow, seedPosts, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

describe('moderation', () => {
  it('blocks from the profile menu after a confirmation, shows the reduced profile, and unblocks', async () => {
    signedInAs(alice);
    seedFollow(alice.id, bob.id);
    renderApp('/u/bob');
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: 'Bob Brown' });
    expect(screen.getByRole('link', { name: 'Message' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Profile options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Block @bob' }));
    await user.click(await screen.findByRole('button', { name: 'Block' }));

    expect(await screen.findByText(/You blocked this member/)).toBeInTheDocument();
    expect(mockDb.blocks).toEqual([{ blockerId: alice.id, blockedId: bob.id }]);
    expect(mockDb.follows).toEqual([]);
    expect(screen.queryByRole('link', { name: 'Message' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Profile options' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Unblock' }));
    expect(
      await within(screen.getByRole('region', { name: 'Bob Brown' })).findByRole('button', {
        name: 'Follow',
      }),
    ).toBeInTheDocument();
    expect(mockDb.blocks).toEqual([]);
    expect(screen.getByRole('link', { name: 'Message' })).toBeInTheDocument();
  });

  it('reports a post from its menu, with a reason and details', async () => {
    signedInAs(alice);
    seedPosts(1);
    renderApp('/');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Post options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Report post' }));
    const dialog = await screen.findByRole('dialog', { name: 'Report this post' });
    expect(within(dialog).getByRole('button', { name: 'Send report' })).toBeDisabled();
    await user.click(within(dialog).getByLabelText('Spam or scam'));
    await user.type(within(dialog).getByLabelText('Details (optional)'), 'Ads everywhere');
    await user.click(within(dialog).getByRole('button', { name: 'Send report' }));

    expect(await screen.findByText('Thank you. We will look into it.')).toBeInTheDocument();
    expect(mockDb.reports).toHaveLength(1);
    expect(mockDb.reports[0]).toMatchObject({
      targetType: 'post',
      targetId: mockDb.posts[0]?.id,
      reason: 'spam',
      details: 'Ads everywhere',
    });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Report this post' })).not.toBeInTheDocument(),
    );
  });

  it('mutes from the profile and unmutes from Settings → Privacy', async () => {
    signedInAs(alice);
    const profile = renderApp('/u/bob');
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: 'Bob Brown' });
    await user.click(screen.getByRole('button', { name: 'Profile options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Mute @bob' }));
    expect(await screen.findByText('Muted')).toBeInTheDocument();
    expect(mockDb.mutes).toEqual([{ muterId: alice.id, mutedId: bob.id }]);

    profile.unmount();
    renderApp('/settings');
    const list = await screen.findByRole('list', { name: 'Muted members' });
    expect(within(list).getByText('Bob Brown')).toBeInTheDocument();
    await user.click(within(list).getByRole('button', { name: 'Unmute @bob' }));
    expect(await screen.findByText('You have not muted anyone.')).toBeInTheDocument();
    expect(mockDb.mutes).toEqual([]);
    expect(screen.getByText('You have not blocked anyone.')).toBeInTheDocument();
  });
});
