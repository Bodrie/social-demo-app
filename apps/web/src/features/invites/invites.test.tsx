import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice, bob, makeNotification, summaryOf } from '@/test/fixtures';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

async function register(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Username'), 'newbie');
  await user.type(screen.getByLabelText('Name'), 'New Person');
  await user.type(screen.getByLabelText('Email'), 'new@example.com');
  await user.type(screen.getByLabelText('Password'), 'Password123!');
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('joining through an invite', () => {
  it('shows who invites and registers with the code', async () => {
    const user = userEvent.setup();
    renderApp('/join/welcome-from-alice');

    expect(
      await screen.findByRole('heading', { name: 'Alice Anderson invited you to BeSo' }),
    ).toBeInTheDocument();
    expect(screen.getByText('@alice')).toBeInTheDocument();
    await register(user);

    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
    expect(mockDb.lastRegistration).toMatchObject({ inviteCode: 'welcome-from-alice' });
  });

  it('still lets the visitor join when the link no longer works', async () => {
    const user = userEvent.setup();
    renderApp('/join/an-old-link-123');

    expect(
      await screen.findByText('This invite link does not work any more, but you can still join.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    await register(user);

    await screen.findByRole('heading', { name: 'Check your inbox' });
    expect(mockDb.lastRegistration).not.toHaveProperty('inviteCode');
  });
});

describe('inviting', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'share');
  });

  it('hands out the link from the account menu: copy, share, or a new one', async () => {
    signedInAs(alice);
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    renderApp('/');

    await user.click(await screen.findByRole('button', { name: /account menu/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Invite friends' }));
    const dialog = await screen.findByRole('dialog', { name: 'Invite friends' });
    const link = within(dialog).getByLabelText('Your invite link');
    await waitFor(() => expect(link).toHaveValue('http://localhost/join/welcome-from-alice'));

    await user.click(within(dialog).getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith('http://localhost/join/welcome-from-alice');
    await user.click(within(dialog).getByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://localhost/join/welcome-from-alice' }),
    );

    await user.click(within(dialog).getByRole('button', { name: 'Get a new link' }));
    await waitFor(() => expect(link).not.toHaveValue('http://localhost/join/welcome-from-alice'));
    expect(mockDb.inviteCodes.has('welcome-from-alice')).toBe(false);
  });

  it('offers it on the member’s own profile too', async () => {
    signedInAs(alice);
    const user = userEvent.setup();
    renderApp('/u/alice');
    await user.click(await screen.findByRole('button', { name: 'Invite friends' }));
    expect(await screen.findByRole('dialog', { name: 'Invite friends' })).toBeInTheDocument();
  });

  it('lets the inviter follow back from the notification', async () => {
    signedInAs(alice);
    mockDb.notifications.push(
      makeNotification('INVITE_JOINED', { actor: summaryOf(bob), post: null }),
    );
    const user = userEvent.setup();
    renderApp('/notifications');

    const list = await screen.findByRole('list', { name: 'Notifications' });
    const row = within(list).getAllByRole('listitem')[0];
    if (!row) throw new Error('no notification');
    expect(row).toHaveTextContent('Bob Brown accepted your invite and follows you');
    await user.click(await within(row).findByRole('button', { name: 'Follow back' }));
    expect(await within(row).findByRole('button', { name: 'Following' })).toBeInTheDocument();
    expect(mockDb.follows).toContainEqual(
      expect.objectContaining({ followerId: alice.id, followingId: bob.id }),
    );
  });
});
