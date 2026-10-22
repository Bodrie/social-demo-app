import { act, screen, waitFor, within } from '@testing-library/react';
import { SOCKET_EVENTS } from '@beso/shared';
import { intersectAll } from '@/test/intersection-observer';
import { alice, carol, makeActivity, summaryOf, testId } from '@/test/fixtures';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';
import { fakeSocket } from '@/test/socket-mock';

const NOW = () => new Date().toISOString();
const itemsOf = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent);

describe('activities', () => {
  it('previews the latest activity in the sidebar and lists everything on the page', async () => {
    signedInAs(alice);
    for (let index = 0; index < 25; index += 1) {
      mockDb.activities.push(makeActivity('PROFILE_UPDATED'));
    }
    const home = renderApp('/');

    const card = await screen.findByRole('list', { name: 'Latest activity' });
    expect(within(card).getAllByRole('listitem')).toHaveLength(6);

    home.unmount();
    renderApp('/activity');
    const page = await screen.findByRole('list', { name: 'Activity' });
    expect(within(page).getAllByRole('listitem')).toHaveLength(20);
    act(() => intersectAll());
    await waitFor(() => expect(within(page).getAllByRole('listitem')).toHaveLength(25));
    expect(await screen.findByText("You're all caught up.")).toBeInTheDocument();
  });

  it('explains an empty activity list', async () => {
    signedInAs(alice);
    renderApp('/activity');
    expect(await screen.findByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument();
    expect(await screen.findByText(/Nothing yet\. Follow people/)).toBeInTheDocument();
  });

  it('puts a pushed activity on top of the sidebar card and the page at once', async () => {
    signedInAs(alice);
    mockDb.activities.push(
      makeActivity('POST_CREATED', { post: { id: testId('post', 1), excerpt: 'Older news' } }),
    );
    renderApp('/activity');
    const page = await screen.findByRole('list', { name: 'Activity' });
    const card = await screen.findByRole('list', { name: 'Latest activity' });
    await waitFor(() => expect(fakeSocket.connected).toBe(true));

    act(() =>
      fakeSocket.serverEmit(
        SOCKET_EVENTS.activityNew,
        makeActivity('POST_CREATED', {
          post: { id: testId('post', 2), excerpt: 'Fresh news' },
          createdAt: NOW(),
        }),
      ),
    );

    await waitFor(() => expect(itemsOf(page)[0]).toContain('Fresh news'));
    expect(itemsOf(page)).toHaveLength(2);
    expect(itemsOf(card)[0]).toContain('Fresh news');
  });

  it('replaces the older line when the same thing happens again', async () => {
    signedInAs(alice);
    const post = { id: testId('post', 3), excerpt: 'Liked twice' };
    mockDb.activities.push(makeActivity('POST_LIKED', { post }));
    mockDb.activities.push(makeActivity('USER_FOLLOWED', { targetUser: summaryOf(carol) }));
    renderApp('/activity');
    const page = await screen.findByRole('list', { name: 'Activity' });
    await waitFor(() => expect(fakeSocket.connected).toBe(true));

    // Bob unliked (nothing is pushed for that) and liked again.
    act(() =>
      fakeSocket.serverEmit(
        SOCKET_EVENTS.activityNew,
        makeActivity('POST_LIKED', { post, createdAt: NOW() }),
      ),
    );

    await waitFor(() => expect(itemsOf(page)[0]).toContain('liked a post'));
    expect(itemsOf(page)).toHaveLength(2);
    expect(itemsOf(page)[1]).toContain('started following');
  });

  it('fetches what happened while the socket was away', async () => {
    signedInAs(alice);
    mockDb.activities.push(
      makeActivity('POST_CREATED', { post: { id: testId('post', 4), excerpt: 'Before' } }),
    );
    renderApp('/activity');
    const page = await screen.findByRole('list', { name: 'Activity' });
    await waitFor(() => expect(fakeSocket.connected).toBe(true));

    act(() => fakeSocket.transportClose());
    // Recorded while no socket was there to push it.
    mockDb.activities.unshift(
      makeActivity('POST_CREATED', {
        post: { id: testId('post', 5), excerpt: 'Missed it' },
        createdAt: NOW(),
      }),
    );
    act(() => fakeSocket.reconnect());

    await waitFor(() => expect(itemsOf(page)[0]).toContain('Missed it'));
  });
});
