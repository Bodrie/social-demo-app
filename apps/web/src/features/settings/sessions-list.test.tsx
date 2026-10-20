import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice, testId } from '@/test/fixtures';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

describe('Settings → Sessions', () => {
  it('lists the devices, marks this one, and signs another one out', async () => {
    signedInAs(alice);
    mockDb.sessions = [
      {
        id: testId('user', 91),
        browser: 'Chrome',
        os: 'Windows',
        ip: '203.0.113.x',
        createdAt: '2026-10-19T08:00:00.000Z',
        lastUsedAt: '2026-10-20T08:00:00.000Z',
        current: true,
      },
      {
        id: testId('user', 92),
        browser: 'Firefox',
        os: 'Linux',
        ip: '198.51.100.x',
        createdAt: '2026-10-18T08:00:00.000Z',
        lastUsedAt: '2026-10-18T09:00:00.000Z',
        current: false,
      },
    ];
    renderApp('/settings');
    const user = userEvent.setup();

    const list = await screen.findByRole('list', { name: 'Sessions' });
    const [mine, theirs] = within(list).getAllByRole('listitem');
    if (!mine || !theirs) throw new Error('two sessions expected');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(mine).toHaveTextContent('Chrome on Windows');
    expect(mine).toHaveTextContent('This device');
    expect(within(mine).queryByRole('button')).toBeNull();
    expect(theirs).toHaveTextContent('Firefox on Linux');
    expect(theirs).toHaveTextContent('198.51.100.x');

    await user.click(within(list).getByRole('button', { name: 'Sign out Firefox on Linux' }));
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(1));
    expect(mockDb.sessions.map((session) => session.browser)).toEqual(['Chrome']);
    expect(screen.getByRole('button', { name: 'Sign out everywhere' })).toBeInTheDocument();
  });
});
