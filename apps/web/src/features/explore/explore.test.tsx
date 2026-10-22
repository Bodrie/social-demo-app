import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice, makePost } from '@/test/fixtures';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

const articles = (feed: HTMLElement) =>
  within(feed)
    .getAllByRole('article')
    .map((article) => article.textContent ?? '');

describe('explore', () => {
  it('shows everyone’s posts, newest first or popular this week', async () => {
    signedInAs(alice);
    mockDb.posts = [
      makePost({ content: 'Fresh and quiet', likeCount: 0 }),
      makePost({ content: 'Older but loved', likeCount: 5, commentCount: 2 }),
    ];
    const user = userEvent.setup();
    renderApp('/');

    // Reached from the navigation.
    await user.click(
      within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('link', {
        name: 'Explore',
      }),
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Explore' })).toBeInTheDocument();
    const latest = await screen.findByRole('feed', { name: 'Latest posts' });
    expect(articles(latest)[0]).toContain('Fresh and quiet');

    await user.click(screen.getByRole('tab', { name: 'Popular this week' }));
    const popular = await screen.findByRole('feed', { name: 'Popular posts this week' });
    await waitFor(() => expect(articles(popular)[0]).toContain('Older but loved'));
    expect(screen.getByRole('tab', { name: 'Popular this week' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('points an empty home feed at Explore and People', async () => {
    signedInAs(alice);
    const user = userEvent.setup();
    renderApp('/');

    const empty = await screen.findByRole('heading', { name: 'Your feed is empty' });
    const card = empty.parentElement;
    if (!card) throw new Error('no empty state');
    expect(within(card).getByRole('link', { name: 'Find people' })).toHaveAttribute(
      'href',
      '/users',
    );
    await user.click(within(card).getByRole('link', { name: 'Explore' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Explore' })).toBeInTheDocument();
  });
});
