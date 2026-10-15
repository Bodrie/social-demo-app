import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice } from '@/test/fixtures';
import { mockDb, seedFollow, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

describe('UsersPage', () => {
  it('lists people and narrows the list while typing', async () => {
    signedInAs(alice);
    renderApp('/users');
    const user = userEvent.setup();

    const list = await screen.findByRole('list', { name: 'People' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);

    await user.type(screen.getByRole('searchbox', { name: 'Search people' }), 'car');
    const results = await screen.findByRole('list', { name: 'Results for car' });
    expect(within(results).getAllByRole('listitem')).toHaveLength(1);
    expect(within(results).getByRole('link', { name: 'Carol Clark' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(await screen.findByRole('list', { name: 'People' })).toBeInTheDocument();
  });

  it('starts from the query in the address and reports no matches', async () => {
    signedInAs(alice);
    renderApp('/users?q=zzz');
    expect(await screen.findByRole('searchbox', { name: 'Search people' })).toHaveValue('zzz');
    expect(
      await screen.findByRole('heading', { name: 'No one matches “zzz”' }),
    ).toBeInTheDocument();
  });

  it('follows someone from the list', async () => {
    signedInAs(alice);
    renderApp('/users?q=bob');
    const user = userEvent.setup();

    const results = await screen.findByRole('list', { name: 'Results for bob' });
    await user.click(within(results).getByRole('button', { name: 'Follow' }));
    expect(within(results).getByRole('button', { name: 'Following' })).toBeInTheDocument();
    await waitFor(() => expect(mockDb.follows).toHaveLength(1));
  });

  it('shows suggestions only for people not yet connected', async () => {
    signedInAs(alice);
    seedFollow(alice.id, mockDb.users[1]!.id);
    renderApp('/users');
    // The sidebar has its own copy; the page shows one inline below the xl breakpoint.
    const main = within(await screen.findByRole('main'));
    const suggestions = await main.findByRole('list', { name: 'Suggestions' });
    expect(within(suggestions).getAllByRole('listitem')).toHaveLength(1);
    expect(within(suggestions).getByRole('link', { name: 'Carol Clark' })).toBeInTheDocument();
  });
});
