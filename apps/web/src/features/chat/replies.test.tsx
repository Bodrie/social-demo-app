import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SOCKET_EVENTS } from '@beso/shared';
import { alice, bob, makeMessage } from '@/test/fixtures';
import { seedDirect } from '@/test/msw/db';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';
import { fakeSocket } from '@/test/socket-mock';

const sends = () =>
  fakeSocket.emitted.filter((e) => e.event === SOCKET_EVENTS.messageSend).map((e) => e.payload);

describe('replies in chat', () => {
  it('answers a message: the bar names it, the sent bubble quotes it', async () => {
    signedInAs(alice);
    const withBob = seedDirect(alice.id, bob.id);
    const question = makeMessage(withBob.id, bob.id, 'Lunch at one?');
    mockDb.messages.push(question, makeMessage(withBob.id, bob.id, 'Or two'));
    renderApp(`/messages/${withBob.id}`);
    const user = userEvent.setup();

    const log = await screen.findByRole('log', { name: 'Conversation with Bob Brown' });
    await waitFor(() => expect(fakeSocket.connected).toBe(true));
    const [first] = within(log).getAllByRole('button', { name: 'Reply' });
    if (!first) throw new Error('a Reply button expected');
    await user.click(first);
    const field = screen.getByRole('textbox', { name: 'Message Bob Brown' });
    await waitFor(() => expect(field).toHaveFocus());
    expect(field).toHaveAccessibleDescription('Replying to Bob BrownLunch at one?');

    await user.type(field, 'Yes!{Enter}');
    await waitFor(() =>
      expect(sends()).toContainEqual(
        expect.objectContaining({ content: 'Yes!', replyToId: question.id }),
      ),
    );
    const quote = await within(log).findByRole('button', {
      name: 'Reply to Bob Brown Lunch at one?',
    });
    expect(quote).toBeInTheDocument();
    expect(screen.queryByText(/^Replying to/)).not.toBeInTheDocument();
  });

  it('lets the reply go with the button or Escape', async () => {
    signedInAs(alice);
    const withBob = seedDirect(alice.id, bob.id);
    mockDb.messages.push(makeMessage(withBob.id, bob.id, 'Hello'));
    renderApp(`/messages/${withBob.id}`);
    const user = userEvent.setup();

    const log = await screen.findByRole('log', { name: 'Conversation with Bob Brown' });
    await user.click(within(log).getByRole('button', { name: 'Reply' }));
    expect(await screen.findByText('Replying to Bob Brown')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel reply' }));
    expect(screen.queryByText('Replying to Bob Brown')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message Bob Brown' })).toHaveFocus();

    await user.click(within(log).getByRole('button', { name: 'Reply' }));
    expect(await screen.findByText('Replying to Bob Brown')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Message Bob Brown' })).toHaveFocus(),
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Replying to Bob Brown')).not.toBeInTheDocument();
  });

  it('quotes the original as it is now, and leads to it', async () => {
    signedInAs(alice);
    const withBob = seedDirect(alice.id, bob.id);
    const his = makeMessage(withBob.id, bob.id, 'Pizza tonight?');
    const mine = makeMessage(withBob.id, alice.id, 'Sure', {
      replyTo: {
        id: his.id,
        senderId: bob.id,
        excerpt: his.content,
        attachment: null,
        deleted: false,
      },
    });
    const orphan = makeMessage(withBob.id, alice.id, 'About that', {
      replyTo: { unavailable: true },
    });
    mockDb.messages.push(his, mine, orphan);
    renderApp(`/messages/${withBob.id}`);
    const user = userEvent.setup();

    const log = await screen.findByRole('log', { name: 'Conversation with Bob Brown' });
    expect(within(log).getByText('Original message unavailable')).toBeInTheDocument();
    await user.click(
      within(log).getByRole('button', { name: 'Reply to Bob Brown Pizza tonight?' }),
    );
    const original = log.querySelector(`[data-message-id="${his.id}"] .ring-2`);
    expect(original).not.toBeNull();

    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.messageUpdated, {
        ...his,
        content: 'Sushi tonight?',
        editedAt: new Date().toISOString(),
      }),
    );
    expect(
      await within(log).findByRole('button', { name: 'Reply to Bob Brown Sushi tonight?' }),
    ).toBeInTheDocument();
    act(() =>
      fakeSocket.serverEmit(SOCKET_EVENTS.messageDeleted, {
        ...his,
        content: '',
        deletedAt: new Date().toISOString(),
      }),
    );
    expect(
      await within(log).findByRole('button', { name: 'Reply to Bob Brown Message deleted' }),
    ).toBeInTheDocument();
  });
});
