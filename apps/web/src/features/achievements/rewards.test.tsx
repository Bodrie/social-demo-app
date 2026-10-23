import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SOCKET_EVENTS } from '@beso/shared';
import { alice, bob, makeBadgeNotification, makePost, summaryOf } from '@/test/fixtures';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';
import { fakeSocket } from '@/test/socket-mock';

const EARNED_AT = '2026-10-20T10:00:00.000Z';
const earn = (userId: string, ...keys: string[]) => {
  for (const key of keys) mockDb.achievements.push({ userId, key, earnedAt: EARNED_AT });
};

describe('badge rewards', () => {
  it('rings the avatar of a collector wherever they appear', async () => {
    signedInAs(alice);
    mockDb.posts.push(
      makePost({ author: { ...summaryOf(bob), ring: 'gold' }, content: 'From a collector' }),
    );
    renderApp('/');

    const card = await screen.findByRole('article', { name: 'Bob Brown' });
    expect(card.querySelector('[data-ring="gold"]')).not.toBeNull();
  });

  it('features chosen badges under the name, at most three', async () => {
    signedInAs(alice);
    earn(alice.id, 'first-post', 'first-like', 'first-comment', 'first-repost');
    renderApp('/u/alice/badges');
    const user = userEvent.setup();

    await screen.findByRole('region', { name: 'Firsts' });
    const toggles = screen.getAllByRole('button', { name: 'Feature on profile' });
    expect(toggles).toHaveLength(4);
    for (const toggle of toggles.slice(0, 3)) {
      // oxlint-disable-next-line no-await-in-loop -- one press after the other
      await user.click(toggle);
      // oxlint-disable-next-line no-await-in-loop
      await waitFor(() => expect(toggle).toHaveAttribute('aria-pressed', 'true'));
    }
    expect(mockDb.user?.featuredBadges).toHaveLength(3);
    expect(toggles[3]).toBeDisabled();
    expect(await screen.findByRole('link', { name: /^4 badges, featured: / })).toBeInTheDocument();
  });

  it('shares a badge as a post with its card, from the Badges tab', async () => {
    signedInAs(alice);
    earn(alice.id, 'first-post');
    renderApp('/u/alice/badges');
    const user = userEvent.setup();

    const started = await screen.findByRole('region', { name: 'Getting started' });
    await user.click(within(started).getByRole('button', { name: 'Share' }));
    const dialog = await screen.findByRole('dialog', { name: 'Share a badge' });
    expect(within(dialog).getByLabelText('Your words')).toHaveValue(
      'I earned “Hello, world” on BeSo.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Share' }));

    expect(await screen.findByText('Shared to your followers')).toBeInTheDocument();
    expect(mockDb.posts[0]).toMatchObject({ achievement: 'first-post' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('link', { name: 'Posts' }));
    const post = await screen.findByRole('article', { name: 'Alice Anderson' });
    expect(await within(post).findByRole('link', { name: /^Badge: Hello, world/ })).toHaveAttribute(
      'href',
      '/u/alice/badges',
    );
  });

  it('celebrates a new badge and offers to share it from the toast', async () => {
    signedInAs(alice);
    renderApp('/');
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Getting started' });
    await waitFor(() => expect(fakeSocket.listenerCount(SOCKET_EVENTS.notificationNew)).toBe(1));

    earn(alice.id, 'first-post');
    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.notificationNew, makeBadgeNotification('first-post')),
    );
    expect(await screen.findByText('You earned “Hello, world”')).toBeInTheDocument();
    expect(document.querySelector('.confetti')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(await screen.findByRole('dialog', { name: 'Share a badge' })).toBeInTheDocument();
  });

  it('lets the member take the ring off in Settings', async () => {
    signedInAs(alice);
    renderApp('/settings');
    const user = userEvent.setup();
    const toggle = await screen.findByRole('switch', { name: 'Show my badge ring' });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    await waitFor(() => expect(mockDb.user?.settings.showRing).toBe(false));
  });
});
