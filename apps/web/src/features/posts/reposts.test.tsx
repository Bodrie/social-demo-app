import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice, carol, summaryOf } from '@/test/fixtures';
import { mockDb, seedPosts, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

const REPOSTED_AT = '2026-10-16T09:00:00.000Z';

describe('reposts', () => {
  it('reposts from the popover without a text, and undoes it the same way', async () => {
    signedInAs(alice);
    seedPosts(1);
    renderApp('/');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Repost 0' }));
    await user.click(await screen.findByRole('button', { name: 'Repost' }));
    expect(await screen.findByRole('button', { name: 'Repost 1' })).toBeInTheDocument();
    await waitFor(() => expect(mockDb.posts[0]?.repostedByMe).toBe(true));

    await user.click(screen.getByRole('button', { name: 'Repost 1' }));
    await user.click(await screen.findByRole('button', { name: 'Undo repost' }));
    expect(await screen.findByRole('button', { name: 'Repost 0' })).toBeInTheDocument();
    await waitFor(() => expect(mockDb.posts[0]?.repostedByMe).toBe(false));
  });

  it('quotes with a text: the quote tops the feed with the original embedded and counted', async () => {
    signedInAs(alice);
    const [original] = seedPosts(1);
    renderApp('/');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Repost 0' }));
    await user.type(screen.getByLabelText('Add your thoughts (optional)'), 'Worth a look');
    await user.click(screen.getByRole('button', { name: 'Quote' }));

    expect(await screen.findByText('Quote posted')).toBeInTheDocument();
    const articles = await screen.findAllByRole('article');
    expect(articles).toHaveLength(2);
    const quote = articles[0];
    if (!quote) throw new Error('no quote card');
    expect(within(quote).getByText('Worth a look')).toBeInTheDocument();
    expect(within(quote).getByText(original?.content ?? '')).toBeInTheDocument();
    expect(within(quote).getByRole('link', { name: /open the quoted post/ })).toHaveAttribute(
      'href',
      `/p/${original?.id}`,
    );
    // The original counts the quote; the quote itself starts at zero.
    expect(
      within(articles[1] ?? quote).getByRole('button', { name: 'Repost 1' }),
    ).toBeInTheDocument();
    expect(mockDb.posts[0]?.quotedPost).toMatchObject({ id: original?.id });
  });

  it('says who reposted a feed item and shows the frame of a deleted original', async () => {
    signedInAs(alice);
    seedPosts(1, { repost: { by: summaryOf(carol), at: REPOSTED_AT } });
    seedPosts(1, { quotedPost: { unavailable: true } });
    renderApp('/');

    const articles = await screen.findAllByRole('article');
    const reposted = articles.find((article) => within(article).queryByText('reposted'));
    if (!reposted) throw new Error('no reposted item');
    expect(within(reposted).getByRole('link', { name: 'Carol Clark' })).toHaveAttribute(
      'href',
      '/u/carol',
    );
    expect(screen.getByText('This post is unavailable')).toBeInTheDocument();
  });

  it('offers no repost on the viewer’s own post, only the count', async () => {
    signedInAs(alice);
    seedPosts(1, { author: summaryOf(alice), repostCount: 3 });
    renderApp('/');

    const article = await screen.findByRole('article');
    expect(within(article).queryByRole('button', { name: /^Repost/ })).not.toBeInTheDocument();
    expect(within(article).getByText('Reposts')).toBeInTheDocument();
    expect(within(article).getByText('3')).toBeInTheDocument();
  });
});
