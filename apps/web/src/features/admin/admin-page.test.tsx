import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice, bob, carol, testId } from '@/test/fixtures';
import { mockDb, seedPosts, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

describe('admin page', () => {
  it('is not there for members', async () => {
    signedInAs(alice);
    renderApp('/admin');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('lists the reports for an admin, settles one and suspends a member', async () => {
    const me = signedInAs(alice);
    me.role = 'admin';
    const [post] = seedPosts(1);
    if (!post) throw new Error('no post');
    mockDb.reports.push(
      {
        id: testId('report', 1),
        targetType: 'post',
        targetId: post.id,
        reason: 'spam',
        details: 'Ads everywhere',
        status: 'open',
        createdAt: '2026-10-16T09:00:00.000Z',
        reporterId: carol.id,
      },
      {
        id: testId('report', 2),
        targetType: 'user',
        targetId: bob.id,
        reason: 'harassment',
        details: null,
        status: 'open',
        createdAt: '2026-10-16T08:00:00.000Z',
        reporterId: carol.id,
      },
    );
    renderApp('/admin');
    const user = userEvent.setup();

    const list = await screen.findByRole('list', { name: 'Reports' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    const [onPost, onMember] = items;
    if (!onPost || !onMember) throw new Error('reports missing');
    expect(onPost).toHaveTextContent('Spam or scam');
    expect(onPost).toHaveTextContent('Carol Clark');
    expect(onPost).toHaveTextContent('Ads everywhere');
    expect(within(onPost).getByRole('link', { name: `“${post.content}”` })).toHaveAttribute(
      'href',
      `/p/${post.id}`,
    );
    expect(onMember).toHaveTextContent('Member');
    expect(within(onMember).getByRole('link', { name: 'Bob Brown' })).toHaveAttribute(
      'href',
      '/u/bob',
    );

    await user.click(within(onPost).getByRole('button', { name: 'Resolve' }));
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(1));
    expect(mockDb.reports[0]?.status).toBe('resolved');

    await user.click(within(list).getByRole('button', { name: 'Suspend member' }));
    await waitFor(() => expect(mockDb.suspended).toEqual([bob.id]));
    expect(
      await within(list).findByRole('button', { name: 'Unsuspend member' }),
    ).toBeInTheDocument();
    expect(within(list).getByText('Suspended')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Resolved' }));
    expect(await screen.findByText('Ads everywhere')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resolve' })).not.toBeInTheDocument();
  });

  it('offers the queue in the account menu to admins only', async () => {
    const me = signedInAs(alice);
    me.role = 'admin';
    renderApp('/');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /account menu/i }));
    expect(await screen.findByRole('menuitem', { name: 'Admin' })).toBeInTheDocument();
  });
});
