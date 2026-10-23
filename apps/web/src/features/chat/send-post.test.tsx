import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw/http';
import { alice, bob, carol, makeMessage } from '@/test/fixtures';
import { seedDirect } from '@/test/msw/db';
import { apiError, mockDb, seedPosts, signedInAs } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';

const GHOST = '00000000-0000-7000-8000-000000000000';

const sharedMessages = () => mockDb.messages.filter((message) => message.sharedPost !== null);
const directWith = (userId: string) =>
  mockDb.conversations.find(
    (c) => c.kind === 'direct' && c.members.some((member) => member.userId === userId),
  );

async function openDialog() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Send post' }));
  const dialog = await screen.findByRole('dialog', { name: 'Send post' });
  return { user, dialog: within(dialog) };
}

describe('sending a post to a chat', () => {
  it('sends to a chat and to someone without one yet, each with the same message', async () => {
    signedInAs(alice);
    const [post] = seedPosts(1);
    const withBob = seedDirect(alice.id, bob.id);
    mockDb.messages.push(makeMessage(withBob.id, bob.id, 'Hi'));
    renderApp('/');
    const { user, dialog } = await openDialog();

    const recent = await dialog.findByRole('list', { name: 'Recent chats' });
    await user.click(within(recent).getByRole('button', { name: /Bob Brown/ }));
    await user.type(dialog.getByRole('searchbox', { name: 'Search chats and people' }), 'car');
    const people = await dialog.findByRole('list', { name: 'People' });
    await user.click(within(people).getByRole('button', { name: /Carol Clark/ }));
    const chosen = dialog.getByRole('list', { name: 'Sending to' });
    expect(
      within(chosen)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Remove Bob Brown', 'Remove Carol Clark']);
    await user.type(dialog.getByLabelText('Message (optional)'), 'Look at this');
    await user.click(dialog.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Sent to 2 chats')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const withCarol = directWith(carol.id);
    expect(
      sharedMessages()
        .map((m) => ({ to: m.conversationId, content: m.content, post: m.sharedPost }))
        .toSorted((a, b) => a.to.localeCompare(b.to)),
    ).toEqual(
      [withBob.id, withCarol?.id ?? '']
        .map((to) => ({ to, content: 'Look at this', post: { id: post?.id } }))
        .toSorted((a, b) => a.to.localeCompare(b.to)),
    );
  });

  it('offers someone with a chat once, as the chat, and keeps what failed chosen', async () => {
    signedInAs(alice);
    seedPosts(1);
    const withBob = seedDirect(alice.id, bob.id);
    mockDb.messages.push(makeMessage(withBob.id, bob.id, 'Hi'));
    server.use(
      http.put(`*/api/v1/conversations/direct/${carol.id}`, () =>
        apiError(403, 'BLOCKED', 'You cannot interact with this member'),
      ),
    );
    renderApp('/');
    const { user, dialog } = await openDialog();

    await user.type(dialog.getByRole('searchbox', { name: 'Search chats and people' }), 'bob');
    // Bob matches as a person too, but is offered once, as the chat with him.
    const chats = await dialog.findByRole('list', { name: 'Chats' });
    expect(dialog.getByRole('status')).toHaveTextContent('1 chat or person found');
    expect(dialog.getAllByRole('button', { name: /Bob Brown/ })).toHaveLength(1);
    await user.click(within(chats).getByRole('button', { name: /Bob Brown/ }));
    await user.clear(dialog.getByRole('searchbox', { name: 'Search chats and people' }));
    await user.type(dialog.getByRole('searchbox', { name: 'Search chats and people' }), 'carol');
    await user.click(
      within(await dialog.findByRole('list', { name: 'People' })).getByRole('button', {
        name: /Carol Clark/,
      }),
    );
    await user.click(dialog.getByRole('button', { name: 'Send' }));

    expect(
      await screen.findByText(
        'Could not send to Carol Clark: You cannot interact with this member',
      ),
    ).toBeInTheDocument();
    expect(sharedMessages().map((m) => m.conversationId)).toEqual([withBob.id]);
    const chosen = dialog.getByRole('list', { name: 'Sending to' });
    expect(
      within(chosen)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Remove Carol Clark']);
  });

  it('shows a sent post as a card in the thread, and a frame once it is gone or kept from me', async () => {
    signedInAs(alice);
    const [post] = seedPosts(1);
    const withBob = seedDirect(alice.id, bob.id);
    mockDb.messages.push(
      makeMessage(withBob.id, bob.id, '', { sharedPost: { id: post?.id ?? '' } }),
      makeMessage(withBob.id, bob.id, 'This one', { sharedPost: { unavailable: true } }),
      makeMessage(withBob.id, alice.id, '', { sharedPost: { id: GHOST } }),
    );
    renderApp(`/messages/${withBob.id}`);

    const log = await screen.findByRole('log', { name: 'Conversation with Bob Brown' });
    const card = await within(log).findByRole('link', { name: /^Post by Bob Brown @bob · / });
    expect(card).toHaveAttribute('href', `/p/${post?.id}`);
    expect(card).toHaveTextContent(post?.content ?? '');
    await waitFor(() =>
      expect(within(log).getAllByText('This post is unavailable')).toHaveLength(2),
    );
    expect(within(log).getByText('This one')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Conversations' });
    expect(within(list).getByRole('link', { name: /Bob Brown/ })).toHaveTextContent('You: Post');
  });
});
