import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice } from '@/test/fixtures';
import { mockDb, seedPosts, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

describe('MentionTextarea', () => {
  it('offers members while an @handle is typed and inserts the pick with Enter', async () => {
    signedInAs(alice);
    renderApp('/');
    const user = userEvent.setup();
    const box = await screen.findByLabelText('New post');

    await user.type(box, 'Hello @bo');
    const listbox = await screen.findByRole('listbox', { name: 'Members' });
    const option = await within(listbox).findByRole('option', { name: /Bob Brown/ });
    expect(within(listbox).getAllByRole('option')).toHaveLength(1);
    expect(option).toHaveAttribute('aria-selected', 'true');
    expect(box).toHaveAttribute('aria-activedescendant', option.id);

    await user.keyboard('{Enter}');
    expect(box).toHaveValue('Hello @bob ');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box).not.toHaveAttribute('aria-activedescendant');
  });

  it('closes on Escape and inserts on click', async () => {
    signedInAs(alice);
    renderApp('/');
    const user = userEvent.setup();
    const box = await screen.findByLabelText('New post');

    await user.type(box, '@car');
    expect(await screen.findByRole('listbox', { name: 'Members' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box).toHaveValue('@car');

    await user.type(box, 'o');
    await user.click(await screen.findByRole('option', { name: /Carol Clark/ }));
    expect(box).toHaveValue('@carol ');
  });

  it('does not open inside an email address or after a word', async () => {
    signedInAs(alice);
    renderApp('/');
    const user = userEvent.setup();
    const box = await screen.findByLabelText('New post');

    await user.type(box, 'mail@bob');
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('lets Enter pick a member in a comment instead of sending it', async () => {
    signedInAs(alice);
    seedPosts(1);
    renderApp('/');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Comments 0' }));
    const section = await screen.findByRole('region', { name: 'Comments' });
    const box = within(section).getByLabelText('Write a comment');

    await user.type(box, 'cc @bo');
    expect(await screen.findByRole('listbox', { name: 'Members' })).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(box).toHaveValue('cc @bob ');
    expect(mockDb.comments).toHaveLength(0);

    await user.keyboard('{Enter}');
    await waitFor(() => expect(mockDb.comments).toHaveLength(1));
    expect(mockDb.comments[0]?.content).toBe('cc @bob');
    // The saved comment links the member the server resolved.
    expect(await within(section).findByRole('link', { name: '@bob' })).toHaveAttribute(
      'href',
      '/u/bob',
    );
  });
});
