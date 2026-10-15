import { act, screen, waitFor } from '@testing-library/react';
import { intersectAll } from '@/test/intersection-observer';
import { alice } from '@/test/fixtures';
import { seedPosts, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

describe('HomePage feed', () => {
  it('shows the first page, then loads more when the end comes into view', async () => {
    signedInAs(alice);
    seedPosts(25);
    renderApp('/');

    expect(await screen.findAllByRole('article')).toHaveLength(20);
    expect(screen.queryByText("You're all caught up.")).not.toBeInTheDocument();

    act(() => intersectAll());
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(25));
    expect(await screen.findByText("You're all caught up.")).toBeInTheDocument();
  });

  it('explains an empty feed', async () => {
    signedInAs(alice);
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Your feed is empty' })).toBeInTheDocument();
  });

  it('renders author, time and counts of a post', async () => {
    signedInAs(alice);
    seedPosts(1, { content: 'Hello there', likeCount: 3, commentCount: 2 });
    renderApp('/');
    const article = await screen.findByRole('article', { name: 'Bob Brown' });
    expect(article).toHaveTextContent('Hello there');
    expect(article).toHaveTextContent('@bob');
    expect(screen.getByRole('button', { name: 'Like 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comments 2' })).toBeInTheDocument();
  });
});
