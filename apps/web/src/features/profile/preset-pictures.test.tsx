import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice } from '@/test/fixtures';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

async function openEditor() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Edit profile' }));
  return { user, dialog: within(await screen.findByRole('dialog', { name: 'Edit profile' })) };
}

describe('ready-made pictures', () => {
  it('can be picked on the registration form, the initials staying the default', async () => {
    renderApp('/register');
    const user = userEvent.setup();

    const group = await screen.findByRole('group', { name: 'Pick a picture (optional)' });
    expect(within(group).getByRole('radio', { name: 'Your initials' })).toBeChecked();
    // The earned ones are not offered to someone without an account.
    expect(within(group).queryByRole('radio', { name: /sunglasses/ })).toBeNull();
    await user.click(within(group).getByRole('radio', { name: 'A bun with a yellow bow' }));

    await user.type(screen.getByLabelText('Username'), 'newbie');
    await user.type(screen.getByLabelText('Name'), 'New Person');
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password123!');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(mockDb.lastRegistration).toMatchObject({ avatarPreset: 'nora' }));
  });

  it('replace the avatar from the profile editor, the earned ones locked until their badge', async () => {
    signedInAs(alice);
    mockDb.achievements = [{ userId: alice.id, key: 'collected-25', earnedAt: alice.createdAt }];
    renderApp('/u/alice');
    const { user, dialog } = await openEditor();

    const [, avatarChoice] = dialog.getAllByRole('button', { name: 'Choose one of ours' });
    if (!avatarChoice) throw new Error('two pickers expected');
    await user.click(avatarChoice);
    const avatars = within(dialog.getByRole('group', { name: 'Ready-made avatars' }));
    expect(
      await avatars.findByRole('radio', {
        name: 'A hat and sunglasses (Unlocks with “Hit (Bronze)”)',
      }),
    ).toBeDisabled();
    await user.click(avatars.getByRole('radio', { name: 'Bald with a full beard' }));
    await user.click(dialog.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(mockDb.user?.avatarPreset).toBe('theo'));
    expect(mockDb.user?.avatarUrl).toMatch(/\/uploads\/preset\/avatar-theo\.webp$/);
  });

  it('give covers too, with the ones a held badge unlocks', async () => {
    signedInAs(alice);
    mockDb.achievements = [{ userId: alice.id, key: 'collected-25', earnedAt: alice.createdAt }];
    renderApp('/u/alice');
    const { user, dialog } = await openEditor();

    const [coverChoice] = dialog.getAllByRole('button', { name: 'Choose one of ours' });
    if (!coverChoice) throw new Error('two pickers expected');
    await user.click(coverChoice);
    const covers = within(dialog.getByRole('group', { name: 'Ready-made covers' }));
    expect(
      await covers.findByRole('radio', {
        name: /^A night sky with a moon \(Unlocks with a hidden badge\)$/,
      }),
    ).toBeDisabled();
    const confetti = covers.getByRole('radio', { name: 'Confetti' });
    await waitFor(() => expect(confetti).toBeEnabled());
    await user.click(confetti);
    await user.click(dialog.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(mockDb.user?.coverPreset).toBe('confetti'));
  });
});
