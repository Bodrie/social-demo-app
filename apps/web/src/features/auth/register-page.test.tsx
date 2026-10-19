import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TurnstileApi } from '@/features/auth/turnstile-loader';
import { mockDb } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

async function fillForm(username: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Username'), username);
  await user.type(screen.getByLabelText('Name'), 'New Person');
  await user.type(screen.getByLabelText('Email'), 'new@example.com');
  await user.type(screen.getByLabelText('Password'), 'Password123!');
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

/** Stands in for Cloudflare's script: hands out a token as soon as the widget renders. */
function stubTurnstile(token = 'cf-token') {
  const api = {
    render: vi.fn((_container: HTMLElement, options: Parameters<TurnstileApi['render']>[1]) => {
      options.callback?.(token);
      return 'widget-1';
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  };
  window.turnstile = api;
  return api;
}

describe('RegisterPage with the bot check', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key-under-test');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.turnstile;
  });

  it('renders the widget, waits for its token and sends it with the registration', async () => {
    const turnstile = stubTurnstile('cf-token-42');
    renderApp('/register');
    await screen.findByLabelText('Username');
    await waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(1));
    expect(turnstile.render.mock.calls[0]?.[1]).toMatchObject({ sitekey: 'site-key-under-test' });

    await fillForm('newbie');
    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
    expect(mockDb.lastRegistration).toMatchObject({ captchaToken: 'cf-token-42' });
  });

  it('shows a refused token under the widget and asks for a new one', async () => {
    const turnstile = stubTurnstile('cf-token-refused');
    renderApp('/register');
    await screen.findByLabelText('Username');
    await waitFor(() => expect(turnstile.render).toHaveBeenCalledTimes(1));

    await fillForm('bot');
    expect(await screen.findByRole('alert')).toHaveTextContent('Please complete the bot check');
    expect(turnstile.reset).toHaveBeenCalledWith('widget-1');
    expect(mockDb.user).toBeNull();
  });

  it('keeps the button disabled until the check has answered', async () => {
    window.turnstile = { render: vi.fn(() => 'widget-1'), reset: vi.fn(), remove: vi.fn() };
    renderApp('/register');
    const button = await screen.findByRole('button', { name: 'Create account' });
    await waitFor(() => expect(window.turnstile?.render).toHaveBeenCalled());
    expect(button).toBeDisabled();
  });
});

describe('RegisterPage', () => {
  it('shows no bot check without a site key', async () => {
    renderApp('/register');
    await screen.findByLabelText('Username');
    expect(screen.queryByTestId('turnstile')).toBeNull();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
  });

  it('attaches server field errors to the right input', async () => {
    renderApp('/register');
    await fillForm('taken');
    expect(await screen.findByText('This username is taken')).toBeInTheDocument();
  });

  it('signs the new member in and holds them on the waiting room until the address is confirmed', async () => {
    renderApp('/register');
    await fillForm('newbie');
    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
    expect(screen.getByText('new@example.com')).toBeInTheDocument();
    expect(screen.queryByLabelText('New post')).not.toBeInTheDocument();
  });
});
