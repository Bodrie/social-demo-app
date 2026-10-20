import { act, screen, waitFor } from '@testing-library/react';
import { alice, bob } from '@/test/fixtures';
import { mockDb, seedPosts, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

const composer = () => screen.getByLabelText('New post');
const lookAtTabAgain = () =>
  act(() => {
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  });

describe('one browser, several tabs', () => {
  it('notices when another tab signed in as someone else, and starts over as that person', async () => {
    signedInAs(alice);
    seedPosts(1, { content: 'Only for alice', likedByMe: true, likeCount: 1 });
    renderApp('/');
    expect(await screen.findByText('Only for alice')).toBeInTheDocument();
    expect(composer()).toHaveAttribute('placeholder', "What's on your mind, Alice?");

    // Another tab signed out and in as Bob: the shared cookies now belong to him.
    signedInAs(bob);
    mockDb.posts = [];
    lookAtTabAgain();

    await waitFor(() =>
      expect(composer()).toHaveAttribute('placeholder', "What's on your mind, Bob?"),
    );
    // Nothing cached for Alice survives (her feed, her "liked" flags).
    expect(await screen.findByRole('heading', { name: 'Your feed is empty' })).toBeInTheDocument();
    expect(screen.queryByText('Only for alice')).not.toBeInTheDocument();
  });

  it.skipIf(typeof BroadcastChannel === 'undefined')(
    'checks at once when another tab announces a sign-in or sign-out',
    async () => {
      signedInAs(alice);
      renderApp('/');
      await screen.findByLabelText('New post');
      const callsBefore = mockDb.calls.me;

      const otherTab = new BroadcastChannel('beso:session');
      try {
        signedInAs(bob);
        // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a BroadcastChannel has no target origin
        otherTab.postMessage('changed');
        await waitFor(() =>
          expect(composer()).toHaveAttribute('placeholder', "What's on your mind, Bob?"),
        );
        expect(mockDb.calls.me).toBeGreaterThan(callsBefore);
      } finally {
        otherTab.close();
      }
    },
  );
});
