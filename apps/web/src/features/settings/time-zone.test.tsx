import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice } from '@/test/fixtures';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

const device = Intl.DateTimeFormat().resolvedOptions().timeZone;

describe('time zone', () => {
  it('is taken from the device when the account has none', async () => {
    signedInAs(alice).settings = { ...alice.settings, timeZone: null };
    renderApp('/');
    await waitFor(() => expect(mockDb.user?.settings.timeZone).toBe(device));
  });

  it('is left alone once set', async () => {
    signedInAs(alice);
    renderApp('/');
    await screen.findByRole('heading', { name: 'Home' });
    expect(mockDb.user?.settings.timeZone).toBe('Europe/Sofia');
  });

  it('can be picked in Settings, or set back to the device’s', async () => {
    signedInAs(alice).settings = { ...alice.settings, timeZone: 'Asia/Tokyo' };
    renderApp('/settings');
    const user = userEvent.setup();

    const select = await screen.findByRole('combobox', { name: 'Time zone' });
    expect(select).toHaveValue('Asia/Tokyo');
    expect(screen.getByText(/It is .* there now\./)).toBeInTheDocument();

    await user.selectOptions(select, 'America/New_York');
    await waitFor(() => expect(mockDb.user?.settings.timeZone).toBe('America/New_York'));

    await user.click(screen.getByRole('button', { name: /Use this device’s/ }));
    await waitFor(() => expect(mockDb.user?.settings.timeZone).toBe(device));
    expect(screen.queryByRole('button', { name: /Use this device’s/ })).not.toBeInTheDocument();
  });
});
