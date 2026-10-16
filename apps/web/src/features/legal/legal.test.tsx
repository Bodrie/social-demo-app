import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice } from '@/test/fixtures';
import { signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';
import { LEGAL_UPDATED_ON } from './legal-layout';

describe('legal pages', () => {
  it('shows the privacy notice to anyone, dated, with a way to the terms', async () => {
    renderApp('/privacy');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Privacy notice' }),
    ).toBeInTheDocument();
    expect(screen.getByText(`Last updated ${LEGAL_UPDATED_ON}`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Your rights' })).toBeInTheDocument();
    // No contact email configured in tests: the repository's issue tracker is the channel.
    expect(screen.getAllByRole('link', { name: 'issue tracker' })[0]).toHaveAttribute(
      'href',
      'https://github.com/Bodrie/social-demo-app/issues',
    );
    const user = userEvent.setup();
    await user.click(
      within(screen.getByRole('navigation', { name: 'Legal pages' })).getByRole('link', {
        name: 'Terms of use',
      }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Terms of use' }),
    ).toBeInTheDocument();
  });

  it('is linked from the sign-in page', async () => {
    renderApp('/login');
    expect(await screen.findByRole('link', { name: 'Privacy notice' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(screen.getByRole('link', { name: 'Terms of use' })).toHaveAttribute('href', '/terms');
  });

  it('asks for agreement on the register form', async () => {
    renderApp('/register');
    expect(await screen.findByText(/By creating an account you agree to the/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Terms of use' })).not.toHaveLength(0);
  });

  it('has an About card in Settings', async () => {
    signedInAs(alice);
    renderApp('/settings');
    expect(await screen.findByRole('link', { name: 'Privacy notice' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Source code' })).toHaveAttribute(
      'href',
      'https://github.com/Bodrie/social-demo-app',
    );
  });

  it('is reachable from the app through the sidebar footer', async () => {
    signedInAs(alice);
    renderApp('/');
    const about = await screen.findByRole('navigation', { name: 'About this site' });
    expect(within(about).getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(within(about).getByRole('link', { name: 'Source' })).toHaveAttribute(
      'href',
      'https://github.com/Bodrie/social-demo-app',
    );
  });
});
