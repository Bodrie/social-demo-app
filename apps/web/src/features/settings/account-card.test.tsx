import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw/http';
import { alice } from '@/test/fixtures';
import { apiError, mockDb, signedInAs } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';

describe('AccountCard', () => {
  it('downloads the export as a JSON file named after the member', async () => {
    signedInAs(alice);
    const downloads: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });
    renderApp('/settings');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Download your data' }));
    expect(await screen.findByText('Your data is downloading')).toBeInTheDocument();
    expect(mockDb.calls.exports).toBe(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(downloads[0]).toMatch(/^beso-export-alice-\d{4}-\d{2}-\d{2}\.json$/);
    click.mockRestore();
  });

  it('asks to wait a minute when the export was just downloaded', async () => {
    signedInAs(alice);
    server.use(
      http.get('*/api/v1/users/me/export', () =>
        apiError(429, 'TOO_MANY_REQUESTS', 'Too many requests'),
      ),
    );
    renderApp('/settings');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Download your data' }));
    expect(await screen.findByText(/Try again in a minute/)).toBeInTheDocument();
  });

  it('puts a wrong password on the field and keeps the account', async () => {
    signedInAs(alice);
    renderApp('/settings');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Delete account' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete your account?' });
    const submit = within(dialog).getByRole('button', { name: 'Delete my account' });
    expect(submit).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Your password'), 'nope');
    await user.click(submit);

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Wrong password');
    expect(mockDb.calls.deletions).toBe(0);
    expect(mockDb.user).not.toBeNull();
  });

  it('deletes the account with the right password and ends the session', async () => {
    signedInAs(alice);
    renderApp('/settings');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Delete account' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete your account?' });
    await user.type(within(dialog).getByLabelText('Your password'), 'Password123!');
    await user.click(within(dialog).getByRole('button', { name: 'Delete my account' }));

    expect(await screen.findByText('Your account was deleted')).toBeInTheDocument();
    await waitFor(() => expect(mockDb.calls.deletions).toBe(1));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(mockDb.user).toBeNull();
  });
});
