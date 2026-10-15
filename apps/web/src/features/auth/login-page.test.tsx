import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/render';
import { redirectTarget } from './redirect-target';

describe('LoginPage', () => {
  it('validates before sending anything', async () => {
    renderApp('/login');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('shows the API message for wrong credentials', async () => {
    renderApp('/login');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });

  it('links to registration', async () => {
    renderApp('/login');
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole('link', { name: 'Create an account' }))[0]!);
    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
  });
});

describe('redirectTarget', () => {
  it('only follows in-app paths', () => {
    expect(redirectTarget({ from: '/users' })).toBe('/users');
    expect(redirectTarget({ from: 'https://evil.example' })).toBe('/');
    expect(redirectTarget({ from: '//evil.example' })).toBe('/');
    expect(redirectTarget(null)).toBe('/');
  });
});
