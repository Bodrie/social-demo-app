import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice } from '@/test/fixtures';
import { signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

describe('AppShell', () => {
  it('offers a skip link and moves focus to the content after navigating from the sidebar', async () => {
    signedInAs(alice);
    renderApp('/');
    const user = userEvent.setup();

    const skip = await screen.findByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveAttribute('href', '#main');

    await user.click(
      screen.getByRole('navigation', { name: 'Main' }).querySelector('a[href="/users"]')!,
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'People' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
  });

  it('shows the in-app not-found page for unknown addresses', async () => {
    signedInAs(alice);
    renderApp('/nothing/here');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });
});
