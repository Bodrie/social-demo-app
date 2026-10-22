import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StoredImage } from '@beso/shared';
import { captureDownloads } from '@/test/downloads';
import { alice, bob, makeMessage, testId } from '@/test/fixtures';
import { seedDirect, seedReadMark } from '@/test/msw/db';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

const picture = (n: number): StoredImage => ({
  url: `http://localhost/api/v1/uploads/message/${testId('message', 900 + n)}.webp`,
  width: 64,
  height: 64,
});
const savedAs = (image: StoredImage) => `beso-${image.url.split('/').pop()}`;

/** Bob's picture, a line of text, then Alice's picture: a thread with two pictures in it. */
function seedPictures() {
  const withBob = seedDirect(alice.id, bob.id);
  const his = makeMessage(withBob.id, bob.id, '', { image: picture(1), imageUrl: picture(1).url });
  const text = makeMessage(withBob.id, alice.id, 'Nice one');
  const mine = makeMessage(withBob.id, alice.id, 'Mine', {
    image: picture(2),
    imageUrl: picture(2).url,
  });
  mockDb.messages.push(his, text, mine);
  seedReadMark(withBob.id, alice.id, mine.createdAt);
  return withBob;
}

afterEach(() => vi.restoreAllMocks());

describe('chat pictures', () => {
  it('pages through the pictures of the thread in the viewer and downloads the one shown', async () => {
    signedInAs(alice);
    const withBob = seedPictures();
    const saved = captureDownloads();
    renderApp(`/messages/${withBob.id}`);
    const user = userEvent.setup();
    const log = await screen.findByRole('log', { name: 'Conversation with Bob Brown' });

    await user.click(
      await within(log).findByRole('button', { name: 'Open picture sent by Bob Brown' }),
    );
    const viewer = await screen.findByRole('dialog', { name: 'Pictures in this conversation' });
    expect(within(viewer).getByRole('img', { name: 'Sent by Bob Brown, 1 of 2' })).toHaveAttribute(
      'src',
      picture(1).url,
    );
    // Focus starts on Close, so Enter never saves a file by accident.
    await waitFor(() =>
      expect(within(viewer).getByRole('button', { name: 'Close' })).toHaveFocus(),
    );

    await user.click(within(viewer).getByRole('button', { name: 'Next picture' }));
    expect(within(viewer).getByRole('img', { name: 'Sent by you, 2 of 2' })).toHaveAttribute(
      'src',
      picture(2).url,
    );
    await user.click(within(viewer).getByRole('button', { name: 'Download picture' }));
    await waitFor(() => expect(saved).toEqual([savedAs(picture(2))]));
  });

  it('downloads a picture from the toolbar beside its message', async () => {
    signedInAs(alice);
    const withBob = seedPictures();
    const saved = captureDownloads();
    renderApp(`/messages/${withBob.id}`);
    const user = userEvent.setup();
    const log = await screen.findByRole('log', { name: 'Conversation with Bob Brown' });
    await within(log).findByText('Nice one');

    const his = within(log)
      .getAllByRole('listitem')
      .find((item) =>
        within(item).queryByRole('button', { name: 'Open picture sent by Bob Brown' }),
      );
    if (!his) throw new Error("Bob's picture is not in the thread");
    // Text alone has nothing to download.
    const text = within(log).getByText('Nice one').closest('li');
    expect(text && within(text).queryByRole('button', { name: 'Download picture' })).toBeNull();

    await user.click(within(his).getByRole('button', { name: 'Download picture' }));
    await waitFor(() => expect(saved).toEqual([savedAs(picture(1))]));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers the download when a picture is held with a finger, without opening it', async () => {
    signedInAs(alice);
    const withBob = seedPictures();
    const saved = captureDownloads();
    renderApp(`/messages/${withBob.id}`);
    const user = userEvent.setup();
    const log = await screen.findByRole('log', { name: 'Conversation with Bob Brown' });
    const open = await within(log).findByRole('button', { name: 'Open picture sent by Bob Brown' });

    const hold = { pointerType: 'touch', isPrimary: true, button: 0, clientX: 5, clientY: 5 };
    fireEvent.pointerDown(open, hold);
    const picker = await screen.findByRole('dialog');
    expect(within(picker).getByRole('button', { name: 'Love' })).toBeInTheDocument();
    // Bob's message: his to edit, not mine.
    expect(within(picker).queryByRole('button', { name: 'Edit message' })).toBeNull();
    fireEvent.pointerUp(open);
    fireEvent.click(open);
    // The release is the hold's: the picture did not open behind the picker.
    expect(
      screen.queryByRole('dialog', { name: 'Pictures in this conversation' }),
    ).not.toBeInTheDocument();

    await user.click(within(picker).getByRole('button', { name: 'Download picture' }));
    await waitFor(() => expect(saved).toEqual([savedAs(picture(1))]));
    expect(screen.queryByRole('button', { name: 'Love' })).toBeNull();
  });

  it('a held picture of my own offers the download next to edit and delete', async () => {
    signedInAs(alice);
    const withBob = seedPictures();
    renderApp(`/messages/${withBob.id}`);
    const log = await screen.findByRole('log', { name: 'Conversation with Bob Brown' });
    const open = await within(log).findByRole('button', { name: 'Open picture sent by you' });

    fireEvent.pointerDown(open, { pointerType: 'touch', isPrimary: true, button: 0 });
    const picker = await screen.findByRole('dialog');
    expect(
      within(picker)
        .getAllByRole('button')
        .slice(-3)
        .map((button) => button.textContent),
    ).toEqual(['Download picture', 'Edit message', 'Delete message']);
    fireEvent.pointerUp(open);
  });
});
