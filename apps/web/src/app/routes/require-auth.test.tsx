import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

describe('route protection', () => {
  it('sends anonymous visitors to the login page and brings them back after signing in', async () => {
    renderApp('/users?tab=all');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'People' })).toBeInTheDocument();
  });

  it('shows the shell to signed-in users', async () => {
    signedInAs();
    renderApp('/');
    expect(await screen.findByRole('heading', { name: /Welcome back, Alice/ })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('keeps signed-in users away from the auth pages', async () => {
    signedInAs();
    renderApp('/login');
    expect(await screen.findByRole('heading', { name: /Welcome back/ })).toBeInTheDocument();
  });

  it('renders a friendly page for unknown routes', async () => {
    signedInAs();
    renderApp('/does-not-exist');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
