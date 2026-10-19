import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice } from '@/test/fixtures';
import { seedPosts, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';
import { searchDestination } from './search-destination';

describe('SearchPage', () => {
  it('searches posts from the header box and switches to people', async () => {
    signedInAs(alice);
    seedPosts(1, { content: 'Hiking boots for sale' });
    seedPosts(1, { content: 'Nothing about footwear' });
    renderApp('/');
    const user = userEvent.setup();

    await user.type(
      await screen.findByRole('searchbox', { name: 'Search' }),
      'hiking boots{Enter}',
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Search' })).toBeInTheDocument();
    const results = await screen.findByRole('feed', { name: 'Posts matching “hiking boots”' });
    expect(within(results).getAllByRole('article')).toHaveLength(1);
    expect(results).toHaveTextContent('Hiking boots for sale');

    await user.click(screen.getByRole('tab', { name: 'People' }));
    expect(
      await screen.findByRole('heading', { name: 'No one matches “hiking boots”' }),
    ).toBeInTheDocument();
  });

  it('lists people for a people search and asks for more letters otherwise', async () => {
    signedInAs(alice);
    renderApp('/search?q=bo&type=people');
    const list = await screen.findByRole('list', { name: 'People matching “bo”' });
    expect(within(list).getByText('Bob Brown')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Posts' }));
    expect(await screen.findByRole('heading', { name: 'No posts match “bo”' })).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Search posts and people'));
    await user.type(screen.getByLabelText('Search posts and people'), 'b');
    expect(
      await screen.findByText('Type at least 2 characters to search posts.'),
    ).toBeInTheDocument();
  });

  it('sends a #tag query to the tag page', async () => {
    signedInAs(alice);
    renderApp('/');
    const user = userEvent.setup();
    await user.type(await screen.findByRole('searchbox', { name: 'Search' }), '#Weekend{Enter}');
    expect(await screen.findByRole('heading', { level: 1, name: '#weekend' })).toBeInTheDocument();
  });
});

describe('searchDestination', () => {
  it('routes tags to their page and everything else to the search page', () => {
    expect(searchDestination('  ')).toBeNull();
    expect(searchDestination('#Weekend')).toBe('/tags/weekend');
    expect(searchDestination('#2026')).toBe('/search?q=%232026');
    expect(searchDestination('two words')).toBe('/search?q=two%20words');
  });
});
