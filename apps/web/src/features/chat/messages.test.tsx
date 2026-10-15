import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SOCKET_EVENTS } from '@the-mesh/shared';
import { alice, bob, carol, makeMessage, summaryOf } from '@/test/fixtures';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';
import { fakeSocket } from '@/test/socket-mock';

const rowsOf = () =>
  within(screen.getByRole('list', { name: 'Conversations' })).getAllByRole('listitem');

function seedChats() {
  mockDb.messages.push(
    makeMessage(alice.id, carol.id, 'Hi Carol', { readAt: '2026-10-15T09:30:00.000Z' }),
    makeMessage(carol.id, alice.id, 'Hey Alice', { readAt: '2026-10-15T09:31:00.000Z' }),
    makeMessage(bob.id, alice.id, 'Lunch?'),
    makeMessage(bob.id, alice.id, 'At noon?'),
  );
}

describe('messages', () => {
  it('lists conversations with unread counts and a navigation badge', async () => {
    signedInAs(alice);
    seedChats();
    renderApp('/messages');

    const list = await screen.findByRole('list', { name: 'Conversations' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Bob Brown');
    expect(rows[0]).toHaveTextContent('At noon?');
    expect(rows[0]).toHaveTextContent('Unread: 2');
    expect(rows[1]).toHaveTextContent('Carol Clark');
    expect(rows[1]).toHaveTextContent('Hey Alice');
    expect(rows[1]).not.toHaveTextContent('Unread');
    expect(screen.getByRole('link', { name: /Messages.*2 unread/ })).toBeInTheDocument();
  });

  it('opens a thread in order, marks it read and sends over the socket', async () => {
    signedInAs(alice);
    seedChats();
    renderApp('/messages/bob');
    const user = userEvent.setup();

    const log = await screen.findByRole('log', { name: 'Conversation with Bob Brown' });
    await within(log).findByText('At noon?');
    const bubbles = within(log)
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(bubbles[0]).toContain('Lunch?');
    expect(bubbles[1]).toContain('At noon?');

    await waitFor(() =>
      expect(fakeSocket.emitted).toContainEqual({
        event: SOCKET_EVENTS.messageRead,
        payload: { userId: bob.id },
      }),
    );
    await waitFor(() => expect(screen.queryByText('Unread: 2')).not.toBeInTheDocument());

    await user.type(screen.getByRole('textbox', { name: 'Message Bob Brown' }), 'Sure!{Enter}');
    expect(await within(log).findByText('Sure!')).toBeInTheDocument();
    await waitFor(() => expect(mockDb.messages.at(-1)?.content).toBe('Sure!'));
    expect(screen.getByRole('textbox', { name: 'Message Bob Brown' })).toHaveValue('');
    const rows = within(screen.getByRole('list', { name: 'Conversations' })).getAllByRole(
      'listitem',
    );
    expect(rows[0]).toHaveTextContent('You: Sure!');
  });

  it('shows pushed messages, counts them unread elsewhere and marks "Seen"', async () => {
    signedInAs(alice);
    seedChats();
    renderApp('/messages/bob');
    const user = userEvent.setup();
    const log = await screen.findByRole('log', { name: 'Conversation with Bob Brown' });
    await within(log).findByText('At noon?');

    // Carol writes while Bob's thread is open: her row moves up with an unread badge.
    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.messageNew, makeMessage(carol.id, alice.id, 'Ping')),
    );
    await waitFor(() => expect(rowsOf()[0]).toHaveTextContent('Carol Clark'));
    expect(rowsOf()[0]).toHaveTextContent('Unread: 1');

    // Bob writes into the open thread: it appears and is read right away, so no badge for him.
    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.messageNew, makeMessage(bob.id, alice.id, 'Great')),
    );
    expect(await within(log).findByText('Great')).toBeInTheDocument();
    await waitFor(() => expect(rowsOf()[0]).toHaveTextContent('Bob Brown'));
    expect(rowsOf()[0]).not.toHaveTextContent('Unread');
    expect(fakeSocket.emitted.filter((e) => e.event === SOCKET_EVENTS.messageRead)).toHaveLength(2);

    // Bob reads what alice sends.
    await user.type(screen.getByRole('textbox', { name: 'Message Bob Brown' }), 'See you{Enter}');
    await within(log).findByText('See you');
    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.conversationRead, {
        userId: bob.id,
        readAt: new Date().toISOString(),
      }),
    );
    expect(await within(log).findByText(/Seen/)).toBeInTheDocument();
  });

  it('starts a new conversation from the people picker', async () => {
    signedInAs(alice);
    renderApp('/messages');
    const user = userEvent.setup();

    const aside = within(await screen.findByRole('complementary', { name: 'Conversations' }));
    await user.click(await aside.findByRole('button', { name: 'New message' }));
    const dialog = await screen.findByRole('dialog', { name: 'New message' });
    await user.type(within(dialog).getByRole('searchbox'), 'car');
    await user.click(await within(dialog).findByRole('button', { name: /Carol Clark/ }));

    expect(
      await screen.findByRole('log', { name: 'Conversation with Carol Clark' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/beginning of your conversation with Carol Clark/),
    ).toBeInTheDocument();
  });

  it('shows who is online and reconnects with a fresh token after a server disconnect', async () => {
    signedInAs(alice);
    mockDb.refreshable = true;
    renderApp('/');
    await screen.findByLabelText('New post');

    await waitFor(() => expect(fakeSocket.connected).toBe(true));
    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.presenceUpdate, [summaryOf(alice), summaryOf(bob)]),
    );
    const online = await screen.findByRole('list', { name: 'Online now' });
    expect(within(online).getAllByRole('listitem')).toHaveLength(1);
    expect(within(online).getByText('Bob Brown')).toBeInTheDocument();

    act(() => fakeSocket.serverDisconnect());
    await waitFor(() => expect(mockDb.calls.refresh).toBe(1));
    await waitFor(() => expect(fakeSocket.connected).toBe(true));
  });

  it('ends the session when the socket cannot be re-authenticated', async () => {
    signedInAs(alice);
    mockDb.refreshable = false;
    renderApp('/');
    await screen.findByLabelText('New post');
    await waitFor(() => expect(fakeSocket.connected).toBe(true));

    act(() => fakeSocket.serverDisconnect());
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});
