import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice, bob, makePost, summaryOf } from '@/test/fixtures';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

const feedOf = (name: string) => screen.findByRole('feed', { name: `Posts by ${name}` });
const articles = (feed: HTMLElement) => within(feed).getAllByRole('article');

describe('pinned posts', () => {
  it('pins my post to the top of my profile and takes it off again', async () => {
    signedInAs(alice);
    const [newer, older] = [
      makePost({ author: summaryOf(alice), content: 'Newer one' }),
      makePost({ author: summaryOf(alice), content: 'Older one' }),
    ];
    mockDb.posts.push(newer, older);
    renderApp('/u/alice');
    const user = userEvent.setup();

    let feed = await feedOf('Alice Anderson');
    const olderCard = articles(feed).find((card) => card.textContent?.includes('Older one'));
    if (!olderCard) throw new Error('the older post expected');
    await user.click(within(olderCard).getByRole('button', { name: 'Post options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Pin to your profile' }));

    expect(await screen.findByText('Pinned to your profile')).toBeInTheDocument();
    feed = await feedOf('Alice Anderson');
    await waitFor(() => expect(articles(feed)[0]).toHaveTextContent(/^Pinned/));
    expect(articles(feed)[0]).toHaveTextContent('Older one');
    // Shown once: first, not again further down.
    expect(articles(feed)).toHaveLength(2);
    expect(mockDb.user?.pinnedPostId).toBe(older.id);

    const pinnedCard = articles(feed)[0];
    if (!pinnedCard) throw new Error('the pinned post expected');
    await user.click(within(pinnedCard).getByRole('button', { name: 'Post options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Unpin from your profile' }));
    await waitFor(() => expect(screen.queryByText('Pinned')).not.toBeInTheDocument());
    expect(articles(await feedOf('Alice Anderson'))[0]).toHaveTextContent('Newer one');
  });

  it("shows another member's pinned post first, without offering to pin it", async () => {
    signedInAs(alice);
    const pinned = makePost({ content: 'Read this first' });
    mockDb.posts.push(makePost({ content: 'Latest from Bob' }), pinned);
    const stored = mockDb.users.find((member) => member.id === bob.id);
    if (stored) stored.pinnedPostId = pinned.id;
    renderApp('/u/bob');
    const user = userEvent.setup();

    const feed = await feedOf('Bob Brown');
    await waitFor(() => expect(articles(feed)[0]).toHaveTextContent('Read this first'));
    expect(articles(feed)[0]).toHaveTextContent('Pinned');
    const first = articles(feed)[0];
    if (!first) throw new Error('the pinned post expected');
    await user.click(within(first).getByRole('button', { name: 'Post options' }));
    expect(await screen.findByRole('menuitem', { name: 'Report post' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Pin to your profile/ })).toBeNull();
  });
});
