import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice, bob, makeUser } from '@/test/fixtures';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

const unverifiedAlice = () => makeUser({ ...alice, emailVerifiedAt: null });

/** `signedInAs` keeps the stored copy of a known user, so the flag is cleared on that copy. */
function signedInUnverified() {
  const me = signedInAs(alice);
  me.emailVerifiedAt = null;
  return me;
}

describe('email verification gate', () => {
  it('holds an unverified member on the waiting room instead of the app', async () => {
    signedInUnverified();
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
    expect(screen.getByText(alice.email)).toBeInTheDocument();
    expect(screen.queryByLabelText('New post')).not.toBeInTheDocument();
  });

  it('keeps unverified members off the auth pages too, and verified ones off the waiting room', async () => {
    signedInUnverified();
    renderApp('/login');
    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
  });

  it('sends the email again on request and reports the hourly limit', async () => {
    signedInUnverified();
    renderApp('/verify-email');
    const user = userEvent.setup();
    const button = await screen.findByRole('button', { name: 'Send the email again' });
    await user.click(button);
    expect(await screen.findByText(/Sent\. Give it a minute/)).toBeInTheDocument();
    expect(mockDb.emailTokens.filter((e) => e.kind === 'verify')).toHaveLength(1);
    await user.click(button);
    await user.click(button);
    await user.click(button);
    expect(await screen.findByText(/asked a few times already/)).toBeInTheDocument();
  });

  it('moves on by itself once the address was confirmed somewhere else', async () => {
    const me = signedInUnverified();
    mockDb.refreshable = true;
    renderApp('/verify-email');
    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();

    // Confirmed on the phone; this tab is looked at again.
    me.emailVerifiedAt = new Date().toISOString();
    act(() => {
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
    });

    expect(await screen.findByLabelText('New post')).toBeInTheDocument();
    // This browser's access token still said "unverified": it was renewed on the way in.
    expect(mockDb.calls.refresh).toBe(1);
  });

  it('lets the member sign out from the waiting room to start over', async () => {
    signedInUnverified();
    renderApp('/verify-email');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /^sign out$/i }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(mockDb.user).toBeNull();
  });

  it('spends the mailed link in the browser that registered and opens the app', async () => {
    const me = signedInUnverified();
    mockDb.emailTokens.push({ token: 'good-link', kind: 'verify', email: me.email });
    renderApp('/verify-email?token=good-link');
    expect(await screen.findByLabelText('New post')).toBeInTheDocument();
    expect(mockDb.user?.emailVerifiedAt).not.toBeNull();
    expect(mockDb.emailTokens).toHaveLength(0);
  });

  it('only confirms the address in a browser without that session, and asks to sign in', async () => {
    const pending = unverifiedAlice();
    mockDb.users.push(pending);
    mockDb.emailTokens.push({ token: 'good-link', kind: 'verify', email: pending.email });
    renderApp('/verify-email?token=good-link');
    expect(
      await screen.findByRole('heading', { name: 'Email address confirmed' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login');
    expect(mockDb.user).toBeNull();
    expect(mockDb.emailTokens).toHaveLength(0);
  });

  it('explains a dead link and points back to sign in', async () => {
    renderApp('/verify-email?token=stale');
    expect(
      await screen.findByRole('heading', { name: 'This link did not work' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/invalid, has expired or was already used/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login');
  });

  it('sends anonymous visitors without a token to sign in', async () => {
    renderApp('/verify-email');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});

describe('forgot and reset password', () => {
  it('asks for the address and confirms the same way whether or not it exists', async () => {
    renderApp('/login');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('link', { name: 'Forgot your password?' }));
    expect(
      await screen.findByRole('heading', { name: 'Forgot your password?' }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), 'nobody@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
    expect(screen.getByText('nobody@example.com')).toBeInTheDocument();
    expect(mockDb.calls.forgot).toBe(1);
    expect(mockDb.emailTokens).toHaveLength(0);
  });

  it('insists the two passwords match before anything is sent', async () => {
    mockDb.users.push(makeUser({ ...bob }));
    mockDb.emailTokens.push({ token: 'reset-link', kind: 'reset', email: bob.email });
    renderApp('/reset-password?token=reset-link');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('New password'), 'Brand-new-1');
    await user.type(screen.getByLabelText('Confirm new password'), 'Brand-new-2');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByText('The passwords do not match')).toBeInTheDocument();
    expect(mockDb.emailTokens).toHaveLength(1);
  });

  it('saves the new password and signs the browser in', async () => {
    mockDb.users.push(makeUser({ ...bob }));
    mockDb.emailTokens.push({ token: 'reset-link', kind: 'reset', email: bob.email });
    renderApp('/reset-password?token=reset-link');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('New password'), 'Brand-new-1');
    await user.type(screen.getByLabelText('Confirm new password'), 'Brand-new-1');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByLabelText('New post')).toBeInTheDocument();
    await waitFor(() => expect(mockDb.user?.id).toBe(bob.id));
  });

  it('shows what went wrong for a spent link and offers a new one', async () => {
    renderApp('/reset-password?token=spent');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('New password'), 'Brand-new-1');
    await user.type(screen.getByLabelText('Confirm new password'), 'Brand-new-1');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(
      await screen.findByRole('heading', { name: 'This link did not work' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('treats a missing token as a broken link right away', async () => {
    renderApp('/reset-password');
    expect(await screen.findByText('This link is incomplete.')).toBeInTheDocument();
  });
});
