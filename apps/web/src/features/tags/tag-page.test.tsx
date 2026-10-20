import { screen, within } from '@testing-library/react';
import { alice } from '@/test/fixtures';
import { seedPosts, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

describe('TagPage', () => {
  it('lists the posts carrying the tag, folding the address', async () => {
    signedInAs(alice);
    seedPosts(2, { content: 'Hiking this #Weekend', hashtags: ['weekend'] });
    seedPosts(1, { content: 'Something else' });
    renderApp('/tags/Weekend');

    expect(await screen.findByRole('heading', { level: 1, name: '#weekend' })).toBeInTheDocument();
    const feed = await screen.findByRole('feed', { name: 'Posts tagged #weekend' });
    expect(within(feed).getAllByRole('article')).toHaveLength(2);
    expect(within(feed).getAllByRole('link', { name: '#Weekend' })[0]).toHaveAttribute(
      'href',
      '/tags/weekend',
    );
    expect(screen.queryByText('Something else')).toBeNull();
    expect(document.title).toBe('#weekend · BeSo');
  });

  it('explains an unused tag and refuses an invalid one', async () => {
    signedInAs(alice);
    const { unmount } = renderApp('/tags/quiet');
    expect(await screen.findByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument();
    unmount();

    renderApp('/tags/2026');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('TrendingCard', () => {
  it('ranks the tags of recent posts and links to their pages', async () => {
    signedInAs(alice);
    seedPosts(2, { hashtags: ['weekend'] });
    seedPosts(1, { hashtags: ['photography', 'weekend'] });
    renderApp('/');

    const list = await screen.findByRole('list', { name: 'Trending tags' });
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('#weekend');
    expect(items[0]).toHaveTextContent('3 posts');
    expect(items[1]).toHaveTextContent('#photography');
    expect(items[1]).toHaveTextContent('1 post');
    expect(within(list).getByRole('link', { name: '#weekend' })).toHaveAttribute(
      'href',
      '/tags/weekend',
    );
  });

  it('stays hidden when nothing is tagged', async () => {
    signedInAs(alice);
    seedPosts(1);
    renderApp('/');
    expect(await screen.findAllByRole('article')).toHaveLength(1);
    expect(screen.queryByRole('list', { name: 'Trending tags' })).toBeNull();
  });
});
