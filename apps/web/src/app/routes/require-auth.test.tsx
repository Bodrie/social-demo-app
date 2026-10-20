import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw/http';
import { alice } from '@/test/fixtures';
import { apiError, signedInAs } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';

describe('RequireAuth', () => {
  it('shows an error with a retry when the session cannot be checked, never the sign-in page', async () => {
    signedInAs(alice);
    server.use(
      http.get('*/api/v1/auth/me', () => apiError(503, 'SERVICE_UNAVAILABLE', 'restarting'), {
        once: true,
      }),
    );
    renderApp('/settings');
    const user = userEvent.setup();

    expect(await screen.findByText(/could not check your session/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  });

  it('sends a signed-out person to sign in without remembering the page', async () => {
    signedInAs(alice);
    renderApp('/settings');
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 1, name: 'Settings' });

    await user.click(screen.getByRole('button', { name: /account menu/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();

    // Signing in again lands on the home feed, not on the previous person's settings.
    signedInAs(alice);
    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByLabelText('New post')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Settings' })).toBeNull();
  });
});
