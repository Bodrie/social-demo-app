import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SOCKET_EVENTS } from '@the-mesh/shared';
import { alice, carol, makeNotification, summaryOf, testId } from '@/test/fixtures';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';
import { fakeSocket } from '@/test/socket-mock';

const post = { id: testId('post', 1), excerpt: 'Hello world' };
const READ_AT = '2026-10-15T09:00:00.000Z';

describe('notifications', () => {
  it('counts the unread ones on the bell, the navigation and the tab, lists them newest first and reads them on opening', async () => {
    signedInAs(alice);
    mockDb.notifications.push(
      makeNotification('POST_LIKED', { post }),
      makeNotification('USER_FOLLOWED', { actor: summaryOf(carol) }),
      makeNotification('POST_COMMENTED', {
        post,
        comment: { id: testId('comment', 1), excerpt: 'Nice!' },
        readAt: READ_AT,
      }),
    );
    renderApp('/');
    const user = userEvent.setup();

    const banner = await screen.findByRole('banner');
    const bell = await within(banner).findByRole('link', { name: 'Notifications, 2 unread' });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: /^Notifications/ })).toHaveTextContent('2 unread');
    await waitFor(() => expect(document.title.startsWith('(2) ')).toBe(true));

    await user.click(bell);
    const list = await screen.findByRole('list', { name: 'Notifications' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Unread: Bob Brown liked your post: “Hello world”'),
      expect.stringContaining('Unread: Carol Clark started following you'),
      expect.stringContaining('Bob Brown commented on your post: “Nice!”'),
    ]);
    expect(items[2]).not.toHaveTextContent('Unread');
    expect(within(list).getByRole('link', { name: '“Hello world”' })).toHaveAttribute(
      'href',
      `/p/${post.id}`,
    );
    expect(within(list).getByRole('link', { name: '“Nice!”' })).toHaveAttribute(
      'href',
      `/p/${post.id}?comment=${testId('comment', 1)}`,
    );

    // Opening the page read everything: the bell drops, the rows keep their marks.
    await waitFor(() => expect(mockDb.calls.notificationsRead).toBe(1));
    expect(within(banner).getByRole('link', { name: 'Notifications' })).toBeInTheDocument();
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('Unread');
  });

  it('puts a pushed notification on top and raises the bell', async () => {
    signedInAs(alice);
    mockDb.notifications.push(makeNotification('USER_FOLLOWED', { readAt: READ_AT }));
    renderApp('/notifications');
    const list = await screen.findByRole('list', { name: 'Notifications' });
    await waitFor(() => expect(mockDb.calls.notificationsRead).toBe(1));

    const pushed = makeNotification('MENTIONED_IN_COMMENT', {
      actor: summaryOf(carol),
      post,
      comment: { id: testId('comment', 2), excerpt: '@alice hi' },
    });
    act(() => fakeSocket.serverEmit(SOCKET_EVENTS.notificationNew, pushed));

    await waitFor(() =>
      expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent(
        'Unread: Carol Clark mentioned you in a comment: “@alice hi”',
      ),
    );
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(
      within(screen.getByRole('banner')).getByRole('link', { name: 'Notifications, 1 unread' }),
    ).toBeInTheDocument();
  });

  it('explains an empty list', async () => {
    signedInAs(alice);
    renderApp('/notifications');
    expect(await screen.findByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument();
    expect(screen.getByText(/follows you or mentions you/)).toBeInTheDocument();
  });
});
