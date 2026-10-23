import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { alice, makeImage, makePost } from '@/test/fixtures';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

const finger = { pointerType: 'touch', isPrimary: true, pointerId: 3, button: 0 };
const mouse = { pointerType: 'mouse', isPrimary: true, pointerId: 1, button: 0 };

/** One tap as a browser reports it: down, up, then the click it turns into. */
function tap(element: Element, pointer: typeof finger, at = { clientX: 100, clientY: 80 }) {
  fireEvent.pointerDown(element, { ...pointer, ...at });
  fireEvent.pointerUp(element, { ...pointer, ...at });
  fireEvent.click(element, at);
}

const likeOf = (card: HTMLElement) => within(card).getByRole('button', { name: /^Like/ });

describe('double tap to like', () => {
  it('likes a post with two quick finger taps and leaves a heart, never unliking', async () => {
    signedInAs(alice);
    mockDb.posts.push(makePost({ content: 'Tap me twice' }));
    renderApp('/');

    const text = await screen.findByText('Tap me twice');
    const card = screen.getByRole('article', { name: 'Bob Brown' });
    tap(text, finger);
    tap(text, finger, { clientX: 104, clientY: 83 });

    await waitFor(() => expect(likeOf(card)).toHaveAttribute('aria-pressed', 'true'));
    expect(card.querySelector('.like-burst')).not.toBeNull();
    await waitFor(() => expect(mockDb.posts[0]?.likedByMe).toBe(true));

    // Again on a liked post: still liked.
    tap(text, finger);
    tap(text, finger);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(likeOf(card)).toHaveAttribute('aria-pressed', 'true');
    expect(mockDb.posts[0]?.likedByMe).toBe(true);
  });

  it('ignores a mouse double click, slow taps and taps on links', async () => {
    signedInAs(alice);
    mockDb.posts.push(makePost({ content: 'Leave me be' }));
    renderApp('/');

    const text = await screen.findByText('Leave me be');
    const card = screen.getByRole('article', { name: 'Bob Brown' });
    tap(text, mouse);
    tap(text, mouse);
    tap(text, finger);
    await new Promise((resolve) => setTimeout(resolve, 350));
    tap(text, finger);
    const author = within(card).getByRole('link', { name: 'Bob Brown' });
    tap(author, finger);
    tap(author, finger);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(likeOf(card)).toHaveAttribute('aria-pressed', 'false');
    expect(card.querySelector('.like-burst')).toBeNull();
  });

  it('opens a picture on one tap, a moment later, and likes on two without opening it', async () => {
    signedInAs(alice);
    mockDb.posts.push(makePost({ content: 'A view', images: [makeImage(1)] }));
    renderApp('/');

    const picture = await screen.findByRole('button', { name: 'Open picture' });
    const card = screen.getByRole('article', { name: 'Bob Brown' });
    tap(picture, finger);
    tap(picture, finger);
    await waitFor(() => expect(likeOf(card)).toHaveAttribute('aria-pressed', 'true'));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    tap(picture, finger);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
