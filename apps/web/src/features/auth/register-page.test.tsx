import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/render';

async function fillForm(username: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Username'), username);
  await user.type(screen.getByLabelText('Name'), 'New Person');
  await user.type(screen.getByLabelText('Email'), 'new@example.com');
  await user.type(screen.getByLabelText('Password'), 'Password123!');
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('RegisterPage', () => {
  it('attaches server field errors to the right input', async () => {
    renderApp('/register');
    await fillForm('taken');
    expect(await screen.findByText('This username is taken')).toBeInTheDocument();
  });

  it('signs the new member in and shows the home page', async () => {
    renderApp('/register');
    await fillForm('newbie');
    expect(
      await screen.findByRole('heading', { name: /Welcome back, New Person/ }),
    ).toBeInTheDocument();
  });
});
