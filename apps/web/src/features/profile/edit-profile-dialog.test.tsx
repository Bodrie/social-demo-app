import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice } from '@/test/fixtures';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

async function openDialog() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Edit profile' }));
  return { user, dialog: await screen.findByRole('dialog', { name: 'Edit profile' }) };
}

describe('EditProfileDialog', () => {
  it('saves changed fields and shows them on the profile', async () => {
    signedInAs(alice);
    renderApp('/u/alice');
    const { user, dialog } = await openDialog();

    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'Alice A.');
    await user.type(within(dialog).getByLabelText('Bio'), 'Hello from the tests');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Profile updated')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Alice A.' })).toBeInTheDocument();
    expect(screen.getByText('Hello from the tests')).toBeInTheDocument();
    expect(mockDb.user).toMatchObject({
      name: 'Alice A.',
      bio: 'Hello from the tests',
      city: 'Sofia',
    });
  });

  it('moves to the new address when the username changes', async () => {
    signedInAs(alice);
    renderApp('/u/alice');
    const { user, dialog } = await openDialog();

    await user.clear(within(dialog).getByLabelText('Username'));
    await user.type(within(dialog).getByLabelText('Username'), 'alice_new');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.getByText('@alice_new')).toBeInTheDocument());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('attaches server conflicts to the field', async () => {
    signedInAs(alice);
    renderApp('/u/alice');
    const { user, dialog } = await openDialog();

    await user.clear(within(dialog).getByLabelText('Username'));
    await user.type(within(dialog).getByLabelText('Username'), 'bob');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await within(dialog).findByText('This username is taken')).toBeInTheDocument();
  });

  it('uploads a new avatar and sends its key', async () => {
    signedInAs(alice);
    renderApp('/u/alice');
    const { user, dialog } = await openDialog();

    const file = new File(['png-bytes'], 'me.png', { type: 'image/png' });
    await user.upload(within(dialog).getByLabelText('Choose avatar'), file);
    await waitFor(() => expect(mockDb.uploads).toBe(1));
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(mockDb.user?.avatarUrl).toMatch(/uploads\/avatar\//));
    expect(await screen.findByText('Profile updated')).toBeInTheDocument();
  });

  it('closes without a request when nothing changed', async () => {
    signedInAs(alice);
    renderApp('/u/alice');
    const { user, dialog } = await openDialog();
    const before = mockDb.user?.updatedAt;

    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockDb.user?.updatedAt).toBe(before);
  });
});
