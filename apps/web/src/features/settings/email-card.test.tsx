import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TEST_PASSWORD, alice } from '@/test/fixtures';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

describe('Settings → Email', () => {
  it('asks for a new address, shows it as pending with resend and cancel, and cancels', async () => {
    signedInAs(alice);
    renderApp('/settings');
    const user = userEvent.setup();

    await screen.findByText(/Your address is/);
    await user.type(screen.getByLabelText('New email address'), 'new@example.com');
    await user.type(screen.getByLabelText('Your password'), TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Send confirmation link' }));

    expect(await screen.findByText(/Waiting for confirmation/)).toBeInTheDocument();
    expect(screen.getByText('new@example.com')).toBeInTheDocument();
    expect(mockDb.user?.pendingEmail).toBe('new@example.com');
    expect(mockDb.emailTokens.filter((e) => e.kind === 'change')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Send the email again' }));
    await waitFor(() =>
      expect(mockDb.emailTokens.filter((e) => e.kind === 'change')).toHaveLength(2),
    );
    await user.click(screen.getByRole('button', { name: 'Cancel the change' }));
    expect(await screen.findByLabelText('New email address')).toBeInTheDocument();
    expect(mockDb.user?.pendingEmail).toBeNull();
  });

  it('keeps the form on a wrong password and says so at the field', async () => {
    signedInAs(alice);
    renderApp('/settings');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('New email address'), 'new@example.com');
    await user.type(screen.getByLabelText('Your password'), 'not-it');
    await user.click(screen.getByRole('button', { name: 'Send confirmation link' }));

    expect(await screen.findByText('Wrong password')).toBeInTheDocument();
    expect(mockDb.user?.pendingEmail).toBeNull();
  });

  it('confirms the new address from the mailed link, signed in or not', async () => {
    const me = signedInAs(alice);
    me.pendingEmail = 'new@example.com';
    mockDb.emailTokens.push({ token: 'change-ok', kind: 'change', email: 'new@example.com' });
    renderApp('/confirm-email?token=change-ok');

    expect(
      await screen.findByRole('heading', { name: 'Email address changed' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/now uses new@example\.com/)).toBeInTheDocument();
    expect(mockDb.user?.email).toBe('new@example.com');
    expect(mockDb.user?.pendingEmail).toBeNull();
  });

  it('explains a spent link', async () => {
    signedInAs(alice);
    renderApp('/confirm-email?token=nope');
    expect(
      await screen.findByRole('heading', { name: 'This link did not work' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('nope')).toBeNull();
    expect(screen.getByRole('link', { name: 'Settings → Email' })).toBeInTheDocument();
  });
});
