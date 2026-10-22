import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SOCKET_EVENTS } from '@beso/shared';
import { alice, bob, makeBadgeNotification } from '@/test/fixtures';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';
import { fakeSocket } from '@/test/socket-mock';

const EARNED_AT = '2026-10-20T09:00:00.000Z';

const earn = (userId: string, ...keys: string[]) => {
  for (const key of keys) mockDb.achievements.push({ userId, key, earnedAt: EARNED_AT });
};

describe('badges on a profile', () => {
  it('shows the member’s own badges, the tiers folded, with progress towards the rest', async () => {
    signedInAs(alice);
    earn(alice.id, 'first-post', 'posts-10', 'pioneer');
    mockDb.achievementProgress = { posts: 12, following: 1, 'membership-days': 4 };
    renderApp('/u/alice/badges');

    expect(await screen.findByText(/You have/)).toHaveTextContent(/You have 3 of \d+ badges\./);
    const milestones = screen.getByRole('region', { name: 'Milestones' });
    const storyteller = within(milestones).getByText('Storyteller').closest('li');
    if (!storyteller) throw new Error('no Storyteller tile');
    expect(storyteller).toHaveTextContent('Storyteller · Bronze');
    // The next tier is the goal: 12 of 50.
    expect(
      within(storyteller).getByRole('progressbar', { name: 'Storyteller (Silver)' }),
    ).toHaveAttribute('value', '12');
    expect(storyteller).toHaveTextContent('Write 50 posts.');

    const gettingStarted = screen.getByRole('region', { name: 'Getting started' });
    expect(within(gettingStarted).getByText('Say cheese').closest('li')).toHaveTextContent(
      'not earned yet',
    );
    const following = within(gettingStarted).getByRole('progressbar', { name: 'Good company' });
    expect(following).toHaveAttribute('value', '1');
    expect(
      within(screen.getByRole('region', { name: 'Tenure' })).getByText('Pioneer'),
    ).toBeInTheDocument();
  });

  it('shows only what another member earned, and the three rarest under their name', async () => {
    signedInAs(alice);
    earn(bob.id, 'first-post', 'first-like', 'posts-10', 'pioneer');
    // Everyone has a first post; bob alone has the rest.
    earn(alice.id, 'first-post');
    renderApp('/u/bob');
    const user = userEvent.setup();

    const strip = await screen.findByRole('link', { name: /^4 badges, the rarest:/ });
    expect(strip).not.toHaveAccessibleName(/Hello, world/);
    await user.click(strip);

    const firsts = await screen.findByRole('region', { name: 'Firsts' });
    expect(within(firsts).getByText('Big heart')).toBeInTheDocument();
    expect(within(firsts).queryByText('Pass it on')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Getting started' })).toBeInTheDocument();
  });

  it('says so when there is nothing to show', async () => {
    signedInAs(alice);
    earn(bob.id, 'first-post');
    const stored = mockDb.users.find((candidate) => candidate.id === bob.id);
    if (!stored) throw new Error('no bob');
    stored.settings = { ...stored.settings, showAchievements: false };
    renderApp('/u/bob/badges');
    expect(await screen.findByRole('heading', { name: 'No badges to show' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /badges, the rarest/ })).not.toBeInTheDocument();
  });
});

describe('getting started', () => {
  it('lists the six steps on Home until hidden, and the Badges tab brings it back', async () => {
    signedInAs(alice);
    earn(alice.id, 'first-post', 'bio');
    renderApp('/');
    const user = userEvent.setup();

    const card = await screen.findByRole('region', { name: 'Getting started' });
    expect(card).toHaveTextContent('2 of 6 done.');
    expect(within(card).getByRole('link', { name: 'Follow three members' })).toHaveAttribute(
      'href',
      '/users',
    );
    expect(within(card).getByText(/Write your first post/)).toHaveTextContent('(done)');

    await user.click(within(card).getByRole('button', { name: 'Hide getting started' }));
    await waitFor(() => expect(card).not.toBeInTheDocument());
    expect(mockDb.user?.settings.hideGettingStarted).toBe(true);

    await user.click(screen.getByRole('button', { name: /account menu/ }));
    await user.click(screen.getByRole('menuitem', { name: /Profile/ }));
    await user.click(await screen.findByRole('link', { name: 'Badges' }));
    await user.click(await screen.findByRole('button', { name: 'Show Getting started on Home' }));
    await waitFor(() => expect(mockDb.user?.settings.hideGettingStarted).toBe(false));
  });

  it('is gone once everything is done', async () => {
    signedInAs(alice);
    earn(alice.id, 'all-set');
    renderApp('/');
    await waitFor(() => expect(mockDb.calls.achievementLists).toBe(1));
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(screen.queryByRole('region', { name: 'Getting started' })).not.toBeInTheDocument();
  });
});

describe('a new badge', () => {
  it('reads as a notification without an actor that leads to the Badges tab', async () => {
    signedInAs(alice);
    earn(alice.id, 'posts-50');
    mockDb.notifications.push(makeBadgeNotification('posts-50'));
    renderApp('/notifications');
    const user = userEvent.setup();

    const list = await screen.findByRole('list', { name: 'Notifications' });
    const [row] = within(list).getAllByRole('listitem');
    if (!row) throw new Error('no notification');
    expect(row).toHaveTextContent('You earned “Storyteller (Silver)”');
    await user.click(within(row).getByRole('link', { name: 'You earned “Storyteller (Silver)”' }));
    expect(await screen.findByRole('region', { name: 'Milestones' })).toBeInTheDocument();
    expect(window.location.pathname).not.toBe('/badges');
  });

  it('pops up while the app is open and refreshes the checklist', async () => {
    signedInAs(alice);
    renderApp('/');
    const user = userEvent.setup();
    const card = await screen.findByRole('region', { name: 'Getting started' });
    expect(card).toHaveTextContent('0 of 6 done.');

    earn(alice.id, 'first-post');
    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.notificationNew, makeBadgeNotification('first-post')),
    );

    expect(await screen.findByText('You earned “Hello, world”')).toBeInTheDocument();
    await waitFor(() => expect(card).toHaveTextContent('1 of 6 done.'));
    await user.click(screen.getByRole('button', { name: 'See badges' }));
    expect(await screen.findByRole('region', { name: 'Milestones' })).toBeInTheDocument();
  });
});

describe('the privacy switch', () => {
  it('hides the badges from others', async () => {
    signedInAs(alice);
    renderApp('/settings');
    const user = userEvent.setup();
    const toggle = await screen.findByRole('switch', { name: 'Show my badges on my profile' });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    await waitFor(() => expect(mockDb.user?.settings.showAchievements).toBe(false));
  });
});
