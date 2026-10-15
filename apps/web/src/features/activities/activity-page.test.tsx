import { act, screen, waitFor, within } from '@testing-library/react';
import { intersectAll } from '@/test/intersection-observer';
import { alice, makeActivity } from '@/test/fixtures';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

describe('activities', () => {
  it('previews the latest activity in the sidebar and lists everything on the page', async () => {
    signedInAs(alice);
    for (let index = 0; index < 25; index += 1) {
      mockDb.activities.push(makeActivity('PROFILE_UPDATED'));
    }
    const home = renderApp('/');

    const card = await screen.findByRole('list', { name: 'Latest activity' });
    expect(within(card).getAllByRole('listitem')).toHaveLength(6);

    home.unmount();
    renderApp('/activity');
    const page = await screen.findByRole('list', { name: 'Activity' });
    expect(within(page).getAllByRole('listitem')).toHaveLength(20);
    act(() => intersectAll());
    await waitFor(() => expect(within(page).getAllByRole('listitem')).toHaveLength(25));
    expect(await screen.findByText("You're all caught up.")).toBeInTheDocument();
  });

  it('explains an empty activity list', async () => {
    signedInAs(alice);
    renderApp('/activity');
    expect(await screen.findByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument();
    expect(await screen.findByText(/Nothing yet\. Follow people/)).toBeInTheDocument();
  });
});
