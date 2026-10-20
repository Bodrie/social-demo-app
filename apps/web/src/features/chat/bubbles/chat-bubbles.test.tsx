import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SOCKET_EVENTS } from '@beso/shared';
import { alice, bob, carol, makeMessage, makeUser, testId } from '@/test/fixtures';
import { seedDirect, upsertUser } from '@/test/msw/db';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';
import { fakeSocket } from '@/test/socket-mock';

/** A message from `senderId` lands in the mock store and is pushed over the fake socket. */
const push = (conversationId: string, senderId: string, text: string) => {
  const message = makeMessage(conversationId, senderId, text);
  mockDb.messages.push(message);
  act(() => fakeSocket.serverEmit(SOCKET_EVENTS.messageNew, message));
  return message;
};
const readEvents = () => fakeSocket.emitted.filter((e) => e.event === SOCKET_EVENTS.messageRead);
const bubbles = () => screen.getByRole('list', { name: 'Chat bubbles' });
const bubble = (name: string | RegExp) => screen.findByRole('button', { name });

async function onHome() {
  renderApp('/');
  await screen.findByLabelText('New post');
  expect(screen.queryByRole('list', { name: 'Chat bubbles' })).toBeNull();
  return userEvent.setup();
}

describe('chat bubbles', () => {
  it('pops a bubble with the unread count; opening it marks the thread read and so does a message into the open window', async () => {
    signedInAs(alice);
    const withBob = seedDirect(alice.id, bob.id);
    const user = await onHome();

    push(withBob.id, bob.id, 'Lunch?');
    await bubble('Open chat with Bob Brown, 1 unread');
    push(withBob.id, bob.id, 'At noon?');
    await bubble('Open chat with Bob Brown, 2 unread');

    await user.click(await bubble(/Open chat with Bob Brown/));
    const chat = await screen.findByRole('dialog', { name: 'Chat with Bob Brown' });
    expect(await within(chat).findByText('At noon?')).toBeInTheDocument();
    await waitFor(() => expect(readEvents()).toHaveLength(1));
    await bubble('Open chat with Bob Brown');

    push(withBob.id, bob.id, 'Still there?');
    expect(await within(chat).findByText('Still there?')).toBeInTheDocument();
    await waitFor(() => expect(readEvents()).toHaveLength(2));
    expect(screen.getByRole('button', { name: 'Open chat with Bob Brown' })).toBeInTheDocument();

    await user.click(within(chat).getByRole('button', { name: 'Minimise chat with Bob Brown' }));
    expect(screen.queryByRole('dialog', { name: 'Chat with Bob Brown' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open chat with Bob Brown' })).toBeInTheDocument();
  });

  it('raises no bubble for a system line', async () => {
    signedInAs(alice);
    const group = seedDirect(alice.id, bob.id);
    await onHome();
    const line = makeMessage(group.id, bob.id, '', {
      kind: 'system',
      system: { type: 'renamed', actor: { id: bob.id, name: 'Bob Brown' }, users: [], title: 'X' },
    });
    mockDb.messages.push(line);
    act(() => fakeSocket.serverEmit(SOCKET_EVENTS.messageNew, line));
    push(group.id, bob.id, 'A real one');
    await bubble('Open chat with Bob Brown, 1 unread');
    expect(within(bubbles()).getAllByRole('listitem')).toHaveLength(1);
  });

  it('ignores my own messages and hides a dismissed bubble until the next message', async () => {
    signedInAs(alice);
    const withBob = seedDirect(alice.id, bob.id);
    const user = await onHome();

    push(withBob.id, alice.id, 'From my other tab');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.queryByRole('list', { name: 'Chat bubbles' })).toBeNull();

    push(withBob.id, bob.id, 'Hey');
    await bubble(/Open chat with Bob Brown/);
    await user.click(screen.getByRole('button', { name: 'Hide chat with Bob Brown' }));
    expect(screen.queryByRole('list', { name: 'Chat bubbles' })).toBeNull();
    // Unread stays: the nav badge still counts.
    expect(screen.getByRole('navigation', { name: 'Main' })).toHaveTextContent(/Messages/);

    push(withBob.id, bob.id, 'Hey again');
    await bubble('Open chat with Bob Brown, 2 unread');
  });

  it('keeps four bubbles and two windows at most, newest nearest the corner', async () => {
    signedInAs(alice);
    const extra = ['dave', 'erin', 'finn'].map((username, index) =>
      upsertUser(
        makeUser({
          id: testId('user', 10 + index),
          username,
          name: `${username[0]?.toUpperCase()}${username.slice(1)} Example`,
          email: `${username}@example.com`,
        }),
      ),
    );
    const threads = [bob, carol, ...extra].map((person) => ({
      person,
      conversation: seedDirect(alice.id, person.id),
    }));
    const user = await onHome();

    for (const { person, conversation } of threads.slice(0, 4))
      push(conversation.id, person.id, 'hi');
    await bubble(/Open chat with Erin Example/);
    expect(within(bubbles()).getAllByRole('listitem')).toHaveLength(4);
    expect(
      within(bubbles()).getAllByRole('button', { name: /^Open chat/ })[0],
    ).toHaveAccessibleName(/Bob Brown/);

    await user.click(await bubble(/Open chat with Bob Brown/));
    await user.click(await bubble(/Open chat with Carol Clark/));
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    await user.click(await bubble(/Open chat with Dave Example/));
    const open = screen.getAllByRole('dialog').map((dialog) => dialog.getAttribute('aria-label'));
    expect(open).toEqual(['Chat with Carol Clark', 'Chat with Dave Example']);

    // A fifth conversation evicts the oldest bubble that has no window: Bob's window closed,
    // so his bubble goes.
    const fifth = threads[4];
    push(fifth!.conversation.id, fifth!.person.id, 'hi');
    await bubble('Open chat with Finn Example, 1 unread');
    const names = within(bubbles())
      .getAllByRole('button', { name: /^Open chat/ })
      .map((button) => button.getAttribute('aria-label'));
    expect(names.some((name) => name?.includes('Bob Brown'))).toBe(false);
    expect(names).toHaveLength(4);
  });

  it('clears everything when the messages page opens and stays quiet there', async () => {
    signedInAs(alice);
    const withBob = seedDirect(alice.id, bob.id);
    const user = await onHome();
    push(withBob.id, bob.id, 'Hey');
    await user.click(await bubble(/Open chat with Bob Brown/));
    await screen.findByRole('dialog', { name: 'Chat with Bob Brown' });

    await user.click(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', {
        name: /Messages/,
      }),
    );
    await screen.findByRole('list', { name: 'Conversations' });
    expect(screen.queryByRole('list', { name: 'Chat bubbles' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Chat with Bob Brown' })).toBeNull();
    push(withBob.id, bob.id, 'Still nothing');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.queryByRole('list', { name: 'Chat bubbles' })).toBeNull();
  });

  it('does nothing when the preference is off', async () => {
    // The mock keeps one copy per account: flip the stored one, not a clone.
    signedInAs(alice).settings = { ...alice.settings, chatBubbles: false };
    const withBob = seedDirect(alice.id, bob.id);
    await onHome();
    push(withBob.id, bob.id, 'Hey');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.queryByRole('list', { name: 'Chat bubbles' })).toBeNull();
  });

  describe('on a phone', () => {
    const width = window.innerWidth;
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: 390,
      });
    });
    afterEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: width,
      });
    });

    it('shows a row of bubbles and one full panel at a time, switching between them', async () => {
      signedInAs(alice);
      const withBob = seedDirect(alice.id, bob.id);
      const withCarol = seedDirect(alice.id, carol.id);
      const user = await onHome();
      push(withBob.id, bob.id, 'Bob here');
      push(withCarol.id, carol.id, 'Carol here');
      await bubble(/Open chat with Carol Clark/);
      // The hide button is always there: no hover on a phone.
      expect(screen.getByRole('button', { name: 'Hide chat with Bob Brown' })).toBeVisible();

      await user.click(await bubble(/Open chat with Bob Brown/));
      expect(
        await screen.findByRole('dialog', { name: 'Chat with Bob Brown' }),
      ).toBeInTheDocument();
      await user.click(await bubble(/Open chat with Carol Clark/));
      await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1));
      expect(screen.getByRole('dialog', { name: 'Chat with Carol Clark' })).toBeInTheDocument();

      // Tapping the active bubble minimises its panel.
      await user.click(screen.getByRole('button', { name: /Open chat with Carol Clark/ }));
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
