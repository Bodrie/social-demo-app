import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SOCKET_EVENTS } from '@the-mesh/shared';
import { alice, bob, carol, makeMessage, summaryOf } from '@/test/fixtures';
import { seedConversation, seedDirect, seedReadMark } from '@/test/msw/db';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';
import { fakeSocket } from '@/test/socket-mock';

const rowsOf = () =>
  within(screen.getByRole('list', { name: 'Conversations' })).getAllByRole('listitem');
const typingEvents = () => fakeSocket.emitted.filter((e) => e.event === SOCKET_EVENTS.typing);
const typingFrom = (conversationId: string, userId: string, typing: boolean) =>
  act(() => fakeSocket.serverEmit(SOCKET_EVENTS.typingUpdate, { conversationId, userId, typing }));
const membersList = (dialog: HTMLElement) =>
  within(within(dialog).getByRole('list', { name: 'Members' })).getAllByRole('listitem');

/** Alice ↔ Carol (all read) and Alice ↔ Bob (two unread from Bob), Bob's being the newer thread. */
function seedChats() {
  const withCarol = seedDirect(alice.id, carol.id);
  const withBob = seedDirect(alice.id, bob.id);
  const [, heyAlice, , atNoon] = [
    makeMessage(withCarol.id, alice.id, 'Hi Carol'),
    makeMessage(withCarol.id, carol.id, 'Hey Alice'),
    makeMessage(withBob.id, bob.id, 'Lunch?'),
    makeMessage(withBob.id, bob.id, 'At noon?'),
  ].map((message) => {
    mockDb.messages.push(message);
    return message;
  });
  seedReadMark(withCarol.id, alice.id, heyAlice?.createdAt ?? null);
  seedReadMark(withCarol.id, carol.id, heyAlice?.createdAt ?? null);
  seedReadMark(withBob.id, bob.id, atNoon?.createdAt ?? null);
  return { withCarol, withBob };
}

describe('messages', () => {
  it('lists conversations with unread counts and a navigation badge', async () => {
    signedInAs(alice);
    seedChats();
    const group = seedConversation('group', [alice.id, bob.id, carol.id], {
      title: 'Weekend plans',
    });
    mockDb.messages.push(makeMessage(group.id, carol.id, 'Hike on Saturday?'));
    renderApp('/messages');

    const list = await screen.findByRole('list', { name: 'Conversations' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Weekend plans');
    expect(rows[0]).toHaveTextContent('Carol: Hike on Saturday?');
    expect(rows[0]).toHaveTextContent('Unread: 1');
    expect(rows[1]).toHaveTextContent('Bob Brown');
    expect(rows[1]).toHaveTextContent('At noon?');
    expect(rows[1]).toHaveTextContent('Unread: 2');
    expect(rows[2]).toHaveTextContent('Carol Clark');
    expect(rows[2]).toHaveTextContent('Hey Alice');
    expect(rows[2]).not.toHaveTextContent('Unread');
    expect(screen.getByRole('link', { name: /Messages.*3 unread/ })).toBeInTheDocument();
  });

  it('opens a thread in order, marks it read and sends over the socket', async () => {
    signedInAs(alice);
    const { withBob } = seedChats();
    renderApp(`/messages/${withBob.id}`);
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
        payload: { conversationId: withBob.id },
      }),
    );
    await waitFor(() => expect(screen.queryByText('Unread: 2')).not.toBeInTheDocument());

    await user.type(screen.getByRole('textbox', { name: 'Message Bob Brown' }), 'Sure!{Enter}');
    expect(await within(log).findByText('Sure!')).toBeInTheDocument();
    await waitFor(() => expect(mockDb.messages.at(-1)?.content).toBe('Sure!'));
    // The push arrives before the ack in the fake (as on the real gateway): never two bubbles.
    expect(within(log).getAllByText('Sure!')).toHaveLength(1);
    await waitFor(() => expect(within(log).queryByText('Sending…')).not.toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: 'Message Bob Brown' })).toHaveValue('');
    expect(rowsOf()[0]).toHaveTextContent('You: Sure!');
  });

  it('shows pushed messages, counts them unread elsewhere and marks "Seen"', async () => {
    signedInAs(alice);
    const { withBob, withCarol } = seedChats();
    renderApp(`/messages/${withBob.id}`);
    const user = userEvent.setup();
    const log = await screen.findByRole('log', { name: 'Conversation with Bob Brown' });
    await within(log).findByText('At noon?');

    // Carol writes while Bob's thread is open: her row moves up with an unread badge.
    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.messageNew, makeMessage(withCarol.id, carol.id, 'Ping')),
    );
    await waitFor(() => expect(rowsOf()[0]).toHaveTextContent('Carol Clark'));
    expect(rowsOf()[0]).toHaveTextContent('Unread: 1');

    // Bob writes into the open thread: it appears and is read right away, so no badge for him.
    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.messageNew, makeMessage(withBob.id, bob.id, 'Great')),
    );
    expect(await within(log).findByText('Great')).toBeInTheDocument();
    await waitFor(() => expect(rowsOf()[0]).toHaveTextContent('Bob Brown'));
    expect(rowsOf()[0]).not.toHaveTextContent('Unread');
    expect(fakeSocket.emitted.filter((e) => e.event === SOCKET_EVENTS.messageRead)).toHaveLength(2);

    // Bob reads what alice sends.
    await user.type(screen.getByRole('textbox', { name: 'Message Bob Brown' }), 'See you{Enter}');
    await within(log).findByText('See you');
    await waitFor(() => expect(within(log).queryByText('Sending…')).not.toBeInTheDocument());
    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.conversationRead, {
        conversationId: withBob.id,
        userId: bob.id,
        readAt: new Date().toISOString(),
      }),
    );
    expect(await within(log).findByText(/Seen/)).toBeInTheDocument();
  });

  it('starts a direct conversation from the people picker', async () => {
    signedInAs(alice);
    renderApp('/messages');
    const user = userEvent.setup();

    const aside = within(await screen.findByRole('complementary', { name: 'Conversations' }));
    await user.click(await aside.findByRole('button', { name: 'New message' }));
    const dialog = await screen.findByRole('dialog', { name: 'New message' });
    await user.type(within(dialog).getByRole('searchbox'), 'car');
    // Wait for the filtered list (the unfiltered one also contains Carol) before clicking.
    await waitFor(() =>
      expect(within(dialog).queryByRole('button', { name: /Bob Brown/ })).not.toBeInTheDocument(),
    );
    await user.click(within(dialog).getByRole('button', { name: /Carol Clark/ }));

    expect(
      await screen.findByRole('log', { name: 'Conversation with Carol Clark' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/beginning of your conversation with Carol Clark/),
    ).toBeInTheDocument();
    // The thread has an address of its own; nothing is listed until someone writes.
    expect(mockDb.conversations[0]).toMatchObject({ kind: 'direct' });
    expect(screen.getByText('No conversations yet.')).toBeInTheDocument();
  });

  it('sends a picture, shows it in the thread and as the conversation snippet', async () => {
    signedInAs(alice);
    const { withBob } = seedChats();
    renderApp(`/messages/${withBob.id}`);
    const user = userEvent.setup();
    const log = await screen.findByRole('log', { name: 'Conversation with Bob Brown' });
    await within(log).findByText('At noon?');

    const sendButton = screen.getByRole('button', { name: 'Send' });
    expect(sendButton).toBeDisabled();
    await user.upload(
      screen.getByLabelText('Attach a picture'),
      new File(['png'], 'photo.png', { type: 'image/png' }),
    );
    expect(await screen.findByRole('img', { name: 'Attachment preview' })).toBeInTheDocument();
    // A picture alone is a message; the button waits for the upload to finish.
    await waitFor(() => expect(sendButton).toBeEnabled());
    await user.click(sendButton);

    expect(await within(log).findByRole('img', { name: 'Sent by you' })).toBeInTheDocument();
    await waitFor(() =>
      expect(mockDb.messages.at(-1)).toMatchObject({
        content: '',
        imageUrl: expect.stringContaining('/uploads/message/'),
      }),
    );
    await waitFor(() => expect(within(log).queryByText('Sending…')).not.toBeInTheDocument());
    // Push and ack confirm the same optimistic bubble: still one picture.
    expect(within(log).getAllByRole('img', { name: 'Sent by you' })).toHaveLength(1);
    expect(screen.queryByRole('img', { name: 'Attachment preview' })).not.toBeInTheDocument();
    expect(rowsOf()[0]).toHaveTextContent('You: Picture');
  });

  it('shows when the peer is typing and signals its own typing sparsely', async () => {
    signedInAs(alice);
    const { withBob, withCarol } = seedChats();
    renderApp(`/messages/${withBob.id}`);
    const user = userEvent.setup();
    const log = await screen.findByRole('log', { name: 'Conversation with Bob Brown' });
    await within(log).findByText('At noon?');

    typingFrom(withBob.id, bob.id, true);
    expect(await within(log).findByText('Bob Brown is typing…')).toBeInTheDocument();
    expect(rowsOf()[0]).toHaveTextContent('typing…');
    // Their message ends the indicator even without an explicit "stopped".
    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.messageNew, makeMessage(withBob.id, bob.id, 'Done')),
    );
    await within(log).findByText('Done');
    expect(within(log).queryByText('Bob Brown is typing…')).not.toBeInTheDocument();
    expect(rowsOf()[0]).not.toHaveTextContent('typing…');

    // Someone typing elsewhere only shows in that conversation's row.
    typingFrom(withCarol.id, carol.id, true);
    await waitFor(() => expect(rowsOf()[1]).toHaveTextContent('typing…'));
    expect(within(log).queryByText(/is typing/)).not.toBeInTheDocument();
    typingFrom(withCarol.id, carol.id, false);
    await waitFor(() => expect(rowsOf()[1]).not.toHaveTextContent('typing…'));

    // My keystrokes: one "typing" for the whole burst, "stopped" when the message goes out.
    await user.type(screen.getByRole('textbox', { name: 'Message Bob Brown' }), 'On my way');
    expect(typingEvents()).toEqual([
      { event: SOCKET_EVENTS.typing, payload: { conversationId: withBob.id, typing: true } },
    ]);
    await user.keyboard('{Enter}');
    await within(log).findByText('On my way');
    expect(typingEvents()).toEqual([
      { event: SOCKET_EVENTS.typing, payload: { conversationId: withBob.id, typing: true } },
      { event: SOCKET_EVENTS.typing, payload: { conversationId: withBob.id, typing: false } },
    ]);
  });

  it('creates a group and shows who is typing and who has seen a message in it', async () => {
    signedInAs(alice);
    renderApp('/messages');
    const user = userEvent.setup();

    const aside = within(await screen.findByRole('complementary', { name: 'Conversations' }));
    await user.click(await aside.findByRole('button', { name: 'New group' }));
    const dialog = await screen.findByRole('dialog', { name: 'New group' });
    await user.type(within(dialog).getByLabelText('Group name'), 'Trip');
    const search = within(dialog).getByRole('searchbox');
    await user.type(search, 'bob');
    await user.click(await within(dialog).findByRole('button', { name: /Bob Brown/ }));
    await user.clear(search);
    await user.type(search, 'car');
    await user.click(await within(dialog).findByRole('button', { name: /Carol Clark/ }));
    expect(within(dialog).getByRole('list', { name: 'Chosen members' })).toHaveTextContent(
      'Bob BrownCarol Clark',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Create group' }));

    const log = await screen.findByRole('log', { name: 'Group Trip' });
    expect(screen.getByText('3 members')).toBeInTheDocument();
    expect(await screen.findByText(/beginning of Trip/)).toBeInTheDocument();
    expect(rowsOf()[0]).toHaveTextContent('Trip');
    const group = mockDb.conversations.find((c) => c.title === 'Trip');
    expect(group?.members.map((m) => m.userId).toSorted()).toEqual(
      [alice.id, bob.id, carol.id].toSorted(),
    );
    if (!group) return;

    await user.type(screen.getByRole('textbox', { name: 'Message Trip' }), 'Where to?{Enter}');
    await within(log).findByText('Where to?');
    await waitFor(() => expect(within(log).queryByText('Sending…')).not.toBeInTheDocument());
    const readBy = (userId: string) =>
      act(() =>
        fakeSocket.serverEmit(SOCKET_EVENTS.conversationRead, {
          conversationId: group.id,
          userId,
          readAt: new Date().toISOString(),
        }),
      );
    readBy(bob.id);
    expect(await within(log).findByText(/Seen by Bob/)).toBeInTheDocument();
    readBy(carol.id);
    expect(await within(log).findByText(/Seen by everyone/)).toBeInTheDocument();

    act(() => {
      fakeSocket.serverEmit(SOCKET_EVENTS.typingUpdate, {
        conversationId: group.id,
        userId: bob.id,
        typing: true,
      });
      fakeSocket.serverEmit(SOCKET_EVENTS.typingUpdate, {
        conversationId: group.id,
        userId: carol.id,
        typing: true,
      });
    });
    expect(
      await within(log).findByText('Bob Brown and Carol Clark are typing…'),
    ).toBeInTheDocument();
    expect(rowsOf()[0]).toHaveTextContent('Bob and Carol are typing…');
    // A group message names its sender in the list.
    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.messageNew, makeMessage(group.id, carol.id, 'Lisbon!')),
    );
    await within(log).findByText('Lisbon!');
    expect(within(log).getByText('Carol')).toBeInTheDocument();
    // Carol's message ended her typing; Bob is still at it, so the row says so until he stops.
    expect(await within(log).findByText('Bob Brown is typing…')).toBeInTheDocument();
    expect(rowsOf()[0]).toHaveTextContent('Bob is typing…');
    typingFrom(group.id, bob.id, false);
    await waitFor(() => expect(rowsOf()[0]).toHaveTextContent('Carol: Lisbon!'));
  });

  it('lists the members of a group, adds people and leaves', async () => {
    signedInAs(alice);
    const group = seedConversation('group', [alice.id, bob.id], { title: 'Trip' });
    const packed = makeMessage(group.id, bob.id, 'Packed?');
    mockDb.messages.push(packed);
    seedReadMark(group.id, alice.id, packed.createdAt);
    renderApp(`/messages/${group.id}`);
    const user = userEvent.setup();
    await screen.findByRole('log', { name: 'Group Trip' });

    await user.click(screen.getByRole('button', { name: 'Members' }));
    const dialog = await screen.findByRole('dialog', { name: 'Trip' });
    expect(membersList(dialog).map((item) => item.textContent)).toEqual([
      expect.stringContaining('Alice Anderson (you)'),
      expect.stringContaining('Bob Brown'),
    ]);

    await user.click(within(dialog).getByRole('button', { name: 'Add people' }));
    await user.type(within(dialog).getByRole('searchbox'), 'car');
    await user.click(await within(dialog).findByRole('button', { name: /Carol Clark/ }));
    await waitFor(() => expect(membersList(dialog)).toHaveLength(3));
    expect(group.members.map((m) => m.userId)).toContain(carol.id);

    await user.click(within(dialog).getByRole('button', { name: 'Leave group' }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Leave Trip?' });
    await user.click(within(confirm).getByRole('button', { name: 'Leave' }));

    expect(await screen.findByText(/Pick a conversation on the left/)).toBeInTheDocument();
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(screen.getByText('No conversations yet.')).toBeInTheDocument();
    expect(group.members.map((m) => m.userId).toSorted()).toEqual([bob.id, carol.id].toSorted());
  });

  it('picks up a group someone added me to, and drops it again when I am removed', async () => {
    signedInAs(alice);
    renderApp('/messages');
    expect(await screen.findByText('No conversations yet.')).toBeInTheDocument();
    // The push handlers attach once the socket client has loaded.
    await waitFor(() => expect(fakeSocket.listenerCount(SOCKET_EVENTS.conversationUpdate)).toBe(1));

    const group = seedConversation('group', [bob.id, alice.id], {
      title: 'Surprise',
      createdById: bob.id,
    });
    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.conversationUpdate, { conversationId: group.id }),
    );
    await waitFor(() => expect(rowsOf()[0]).toHaveTextContent('Surprise'));
    expect(rowsOf()[0]).toHaveTextContent('2 members · no messages yet');

    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.conversationRemoved, { conversationId: group.id }),
    );
    expect(await screen.findByText('No conversations yet.')).toBeInTheDocument();
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
