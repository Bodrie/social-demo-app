import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice } from '@/test/fixtures';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

describe('Header', () => {
  it('toggles the theme and remembers it', async () => {
    signedInAs(alice);
    renderApp('/');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Switch to dark theme' }));

    await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
    expect(window.localStorage.getItem('beso:theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });

  it('opens the navigation with focus on the panel, not in the search box', async () => {
    signedInAs(alice);
    renderApp('/');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Open navigation' }));

    const sheet = await screen.findByRole('dialog', { name: 'Navigation' });
    // A focused field would bring a phone's keyboard up over the links.
    await waitFor(() => expect(sheet).toHaveFocus());
    await user.tab();
    expect(within(sheet).getByRole('searchbox')).toHaveFocus();
  });

  it('signs out from the account menu', async () => {
    signedInAs(alice);
    renderApp('/');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /account menu/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(mockDb.calls.logout).toBe(1);
  });
});
