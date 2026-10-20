import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw/http';
import { alice } from '@/test/fixtures';
import { apiError, mockDb, signedInAs } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';

async function fill(user: ReturnType<typeof userEvent.setup>, values: [string, string, string]) {
  await user.type(screen.getByLabelText('Current password'), values[0]);
  await user.type(screen.getByLabelText('New password'), values[1]);
  await user.type(screen.getByLabelText('Confirm new password'), values[2]);
  await user.click(screen.getByRole('button', { name: 'Change password' }));
}

describe('SettingsPage', () => {
  it('is reachable from the account menu and validates the password form', async () => {
    signedInAs(alice);
    renderApp('/');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /account menu/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Settings' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();

    await fill(user, ['Password123!', 'NewPassword456!', 'different']);
    expect(await screen.findByText('The passwords do not match')).toBeInTheDocument();
    expect(mockDb.calls.passwordChanges).toBe(0);
  });

  it('puts a wrong current password on its field', async () => {
    signedInAs(alice);
    renderApp('/settings');
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await fill(user, ['nope', 'NewPassword456!', 'NewPassword456!']);
    expect(await screen.findByText('Wrong password')).toBeInTheDocument();
  });

  it('changes the password, confirms and clears the form', async () => {
    signedInAs(alice);
    renderApp('/settings');
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await fill(user, ['Password123!', 'NewPassword456!', 'NewPassword456!']);
    expect(await screen.findByText(/Password changed/)).toBeInTheDocument();
    await waitFor(() => expect(mockDb.calls.passwordChanges).toBe(1));
    expect(screen.getByLabelText('Current password')).toHaveValue('');
  });

  it('offers the theme choice and signing out everywhere', async () => {
    signedInAs(alice);
    renderApp('/settings');
    const user = userEvent.setup();
    const theme = within(await screen.findByRole('group', { name: 'Theme' }));
    await user.click(theme.getByRole('button', { name: 'Dark' }));
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
    expect(theme.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Sign out everywhere' }));
    await user.click(await screen.findByRole('button', { name: 'Sign out everywhere' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('stores the chat bubbles preference on the account', async () => {
    signedInAs(alice);
    renderApp('/settings');
    const user = userEvent.setup();
    const toggle = await screen.findByRole('switch', {
      name: 'Show chat bubbles for new messages',
    });
    expect(toggle).toBeChecked();

    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    await waitFor(() => expect(mockDb.user?.settings.chatBubbles).toBe(false));
  });

  it('stores the sound and notification preferences, asking the browser for permission first', async () => {
    signedInAs(alice);
    const requestPermission = vi.fn(() => Promise.resolve('granted' as const));
    vi.stubGlobal('Notification', { permission: 'default', requestPermission });
    renderApp('/settings');
    const user = userEvent.setup();

    const sound = await screen.findByRole('switch', { name: 'Play a sound for new messages' });
    expect(sound).not.toBeChecked();
    await user.click(sound);
    await waitFor(() => expect(mockDb.user?.settings.messageSound).toBe(true));

    const notify = screen.getByRole('switch', {
      name: 'Show browser notifications for new messages',
    });
    await user.click(notify);
    await waitFor(() => expect(mockDb.user?.settings.browserNotifications).toBe(true));
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(notify).toBeChecked();
    vi.unstubAllGlobals();
  });

  it('keeps browser notifications off when the browser refuses them', async () => {
    signedInAs(alice);
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: vi.fn(() => Promise.resolve('denied' as const)),
    });
    renderApp('/settings');
    const user = userEvent.setup();
    const notify = await screen.findByRole('switch', {
      name: 'Show browser notifications for new messages',
    });
    await user.click(notify);
    expect(
      await screen.findByText('Notifications are blocked for this site in your browser'),
    ).toBeInTheDocument();
    expect(notify).not.toBeChecked();
    expect(mockDb.user?.settings.browserNotifications).toBe(false);
    vi.unstubAllGlobals();
  });

  it('keeps the session and says so when signing out everywhere fails', async () => {
    signedInAs(alice);
    server.use(
      http.post('*/api/v1/auth/logout-all', () => apiError(500, 'INTERNAL_ERROR', 'boom')),
    );
    renderApp('/settings');
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 1, name: 'Settings' });

    await user.click(screen.getByRole('button', { name: 'Sign out everywhere' }));
    await user.click(await screen.findByRole('button', { name: 'Sign out everywhere' }));

    expect(await screen.findByText(/Could not sign out everywhere/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(mockDb.user).not.toBeNull();
  });
});
