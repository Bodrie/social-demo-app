import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw/http';
import { alice, bob, makeNotification, makePoll, makePost, summaryOf } from '@/test/fixtures';
import { apiError, mockDb, signedInAs } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';

const HOUR = 3_600_000;

const results = () => screen.getByRole('list', { name: 'Poll results' });
const rowOf = (text: string) =>
  within(results())
    .getAllByRole('listitem')
    .find((item) => item.textContent?.startsWith(text));

describe('polls', () => {
  it('asks a poll from the composer: options, length, and the post carries it', async () => {
    signedInAs(alice);
    renderApp('/');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Poll' }));
    const first = await screen.findByRole('textbox', { name: 'Option 1' });
    expect(first).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Poll' })).toHaveAttribute('aria-pressed', 'true');
    await user.type(first, 'Saturday');
    await user.type(screen.getByRole('textbox', { name: 'Option 2' }), 'Sunday');
    await user.click(screen.getByRole('button', { name: 'Add option' }));
    expect(screen.getByRole('textbox', { name: 'Option 3' })).toHaveFocus();
    await user.type(screen.getByRole('textbox', { name: 'Option 3' }), 'Both');
    await user.selectOptions(screen.getByLabelText('Open for'), '3 days');
    await user.type(screen.getByLabelText('New post'), 'Which day for the hike?');
    await user.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByText('Posted')).toBeInTheDocument();
    const poll = mockDb.posts[0]?.poll;
    expect(poll?.options.map((option) => option.text)).toEqual(['Saturday', 'Sunday', 'Both']);
    const closesIn = Date.parse(poll?.closesAt ?? '') - Date.now();
    expect(closesIn).toBeGreaterThan(71 * HOUR);
    expect(closesIn).toBeLessThanOrEqual(72 * HOUR);
    expect(screen.queryByRole('textbox', { name: 'Option 1' })).not.toBeInTheDocument();
    // The author sees the results from the start.
    const article = await screen.findByRole('article', { name: 'Alice Anderson' });
    expect(within(article).getByRole('list', { name: 'Poll results' })).toHaveTextContent(
      'Saturday0 %',
    );
    expect(article).toHaveTextContent('0 votes · 3 days left');
  });

  it('says what is wrong with a poll before sending it, and keeps pictures and polls apart', async () => {
    signedInAs(alice);
    renderApp('/');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Poll' }));
    await user.type(await screen.findByRole('textbox', { name: 'Option 1' }), 'Yes');
    await user.type(screen.getByLabelText('New post'), 'Well?');
    await user.click(screen.getByRole('button', { name: 'Post' }));
    expect(await screen.findByText('Write the option or remove it')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Option 2' }), 'yes');
    expect(screen.queryByText('Write the option or remove it')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Post' }));
    expect(await screen.findByText('Each option only once')).toBeInTheDocument();
    expect(mockDb.posts).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Add image' }));
    expect(await screen.findByText('A post has pictures or a poll, not both.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove poll' }));
    expect(screen.queryByRole('textbox', { name: 'Option 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Poll' })).toHaveFocus();
  });

  it('votes with one press and shows the results with the choice ticked', async () => {
    signedInAs(alice);
    const post = makePost({ poll: makePoll(['Saturday', 'Sunday'], { totalVotes: 3 }) });
    mockDb.posts.push(post);
    mockDb.pollCounts.set(post.id, [2, 1]);
    renderApp('/');
    const user = userEvent.setup();

    const poll = await screen.findByRole('list', { name: 'Poll' });
    const article = screen.getByRole('article', { name: 'Bob Brown' });
    expect(article).toHaveTextContent('3 votes · 1 day left');
    expect(screen.queryByRole('list', { name: 'Poll results' })).not.toBeInTheDocument();
    await user.click(within(poll).getByRole('button', { name: 'Vote for Sunday' }));

    await waitFor(() => expect(rowOf('Sunday')).toHaveTextContent('Sunday, your vote50 %'));
    expect(rowOf('Saturday')).toHaveTextContent('Saturday50 % (2 votes)');
    expect(article).toHaveTextContent('4 votes');
    expect(screen.queryByRole('button', { name: /^Vote for/ })).not.toBeInTheDocument();
  });

  it('marks the leader of a closed poll, and loads the results of one that closed on screen', async () => {
    signedInAs(alice);
    const ended = makePost({
      content: 'Closed already',
      poll: makePoll(['Tea', 'Coffee'], { counts: [1, 3], closed: true }),
    });
    const lapsed = makePost({
      content: 'Ran out',
      author: summaryOf(bob),
      poll: makePoll(['Up', 'Down'], {
        totalVotes: 2,
        closesAt: new Date(Date.now() - 1000).toISOString(),
      }),
    });
    mockDb.posts.push(ended, lapsed);
    renderApp('/');
    const user = userEvent.setup();

    const closedCard = await screen.findByRole('article', {
      name: (_, element) => element.textContent?.includes('Closed already') ?? false,
    });
    expect(closedCard).toHaveTextContent('4 votes · Final results');
    const coffee = within(within(closedCard).getByRole('list', { name: 'Poll results' }))
      .getAllByRole('listitem')
      .find((item) => item.textContent?.startsWith('Coffee'));
    expect(coffee?.querySelector('.font-semibold')).not.toBeNull();

    const lapsedCard = screen.getByRole('article', {
      name: (_, element) => element.textContent?.includes('Ran out') ?? false,
    });
    expect(lapsedCard).toHaveTextContent('2 votes · Poll closed');
    expect(within(lapsedCard).queryByRole('button', { name: /^Vote for/ })).toBeNull();
    server.use(
      http.get(`*/api/v1/posts/${lapsed.id}`, () =>
        HttpResponse.json({
          ...lapsed,
          poll: makePoll(['Up', 'Down'], { counts: [2, 0], closed: true }),
        }),
      ),
    );
    await user.click(within(lapsedCard).getByRole('button', { name: 'See the results' }));
    await waitFor(() => expect(lapsedCard).toHaveTextContent('2 votes · Final results'));
  });

  it('says why a vote was refused and shows the poll as it now is', async () => {
    signedInAs(alice);
    const post = makePost({ poll: makePoll(['Yes', 'No'], { totalVotes: 1 }) });
    mockDb.posts.push(post);
    server.use(
      http.put(`*/api/v1/posts/${post.id}/poll/vote`, () =>
        apiError(409, 'CONFLICT', 'This poll has closed'),
      ),
      http.get(`*/api/v1/posts/${post.id}`, () =>
        HttpResponse.json({
          ...post,
          poll: makePoll(['Yes', 'No'], { counts: [1, 0], closed: true }),
        }),
      ),
    );
    renderApp('/');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Vote for No' }));
    expect(await screen.findByText('This poll has closed')).toBeInTheDocument();
    expect(await screen.findByRole('list', { name: 'Poll results' })).toBeInTheDocument();
  });

  it('names a poll inside a quote without showing it', async () => {
    signedInAs(alice);
    const original = makePost({ poll: makePoll(['A', 'B']) });
    mockDb.posts.push(
      makePost({
        content: 'Vote on this',
        author: summaryOf(alice),
        quotedPost: {
          id: original.id,
          author: original.author,
          content: original.content,
          images: [],
          imageUrl: null,
          hasPoll: true,
          createdAt: original.createdAt,
        },
      }),
    );
    renderApp('/');

    const quote = await screen.findByRole('article', { name: 'Alice Anderson' });
    expect(within(quote).getByText('Poll')).toBeInTheDocument();
    expect(within(quote).queryByRole('button', { name: /^Vote for/ })).toBeNull();
  });

  it('tells the author and the voters that the results are in', async () => {
    signedInAs(alice);
    const excerpt = { id: makePost().id, excerpt: 'Tea or coffee?' };
    mockDb.notifications = [
      makeNotification('POLL_ENDED', { actor: null, post: excerpt }),
      makeNotification('POLL_ENDED', { actor: summaryOf(bob), post: excerpt }),
    ];
    renderApp('/notifications');

    const list = await screen.findByRole('list', { name: 'Notifications' });
    const [own, voted] = within(list).getAllByRole('listitem');
    if (!own || !voted) throw new Error('two notifications expected');
    expect(own).toHaveTextContent('The results of your poll are in: “Tea or coffee?”');
    expect(voted).toHaveTextContent('Bob Brown asked, and the results are in: “Tea or coffee?”');
    expect(within(own).getByRole('link', { name: '“Tea or coffee?”' })).toHaveAttribute(
      'href',
      `/p/${excerpt.id}`,
    );
  });
});
