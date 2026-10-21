import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice } from '@/test/fixtures';
import { http } from 'msw/http';
import { apiError, mockDb, signedInAs } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render';

const picture = (name: string) => new File(['png-bytes'], name, { type: 'image/png' });
const previews = () => screen.getAllByRole('img', { name: /^Attachment preview \d$/ });

describe('PostComposer', () => {
  it('publishes text and shows the new post first', async () => {
    signedInAs(alice);
    renderApp('/');
    const user = userEvent.setup();

    const publish = await screen.findByRole('button', { name: 'Post' });
    expect(publish).toBeDisabled();
    await user.type(screen.getByLabelText('New post'), 'First!');
    expect(publish).toBeEnabled();
    await user.click(publish);

    const article = await screen.findByRole('article', { name: 'Alice Anderson' });
    expect(article).toHaveTextContent('First!');
    expect(screen.getByLabelText('New post')).toHaveValue('');
    expect(mockDb.posts[0]?.content).toBe('First!');
  });

  it('uploads an attached image before publishing and sends its key', async () => {
    signedInAs(alice);
    renderApp('/');
    const user = userEvent.setup();

    const file = new File(['png-bytes'], 'photo.png', { type: 'image/png' });
    await user.upload(await screen.findByLabelText('Attach an image'), file);
    expect(await screen.findByRole('img', { name: 'Attachment preview' })).toBeInTheDocument();
    await waitFor(() => expect(mockDb.uploads).toBe(1));

    await user.type(screen.getByLabelText('New post'), 'With a picture');
    await user.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() =>
      expect(mockDb.posts[0]?.images).toEqual([
        { url: expect.stringMatching(/uploads\/post\//), width: 64, height: 64 },
      ]),
    );
    expect(screen.queryByRole('img', { name: 'Attachment preview' })).not.toBeInTheDocument();
  });

  it('attaches up to four pictures and publishes the ones kept, in their order', async () => {
    signedInAs(alice);
    renderApp('/');
    const user = userEvent.setup();
    const input = await screen.findByLabelText('Attach an image');

    await user.upload(input, [picture('a.png'), picture('b.png'), picture('c.png')]);
    expect(await screen.findByRole('img', { name: 'Attachment preview 3' })).toBeInTheDocument();
    // Two more: one fits, the other is refused with a reason.
    await user.upload(input, [picture('d.png'), picture('e.png')]);
    expect(await screen.findByText('At most 4 pictures per post.')).toBeInTheDocument();
    expect(previews()).toHaveLength(4);
    await waitFor(() => expect(mockDb.uploads).toBe(4));

    await user.click(screen.getByRole('button', { name: 'Remove image 2' }));
    expect(previews()).toHaveLength(3);
    await user.type(screen.getByLabelText('New post'), 'Three of them');
    await user.click(screen.getByRole('button', { name: 'Post' }));

    await waitFor(() => expect(mockDb.posts[0]?.content).toBe('Three of them'));
    expect(mockDb.posts[0]?.images.map((image) => mockDb.uploadedNames.get(image.url))).toEqual([
      'a.png',
      'c.png',
      'd.png',
    ]);
    const article = await screen.findByRole('article', { name: 'Alice Anderson' });
    expect(within(article).getAllByRole('button', { name: /^Open picture \d of 3$/ })).toHaveLength(
      3,
    );
    expect(screen.queryByRole('img', { name: /^Attachment preview/ })).not.toBeInTheDocument();
  });

  it('keeps the post back while a picture failed and sends it after a retry', async () => {
    signedInAs(alice);
    let failures = 1;
    server.use(
      http.post('*/api/v1/uploads', () =>
        failures-- > 0 ? apiError(500, 'INTERNAL_ERROR', 'Upload failed') : undefined,
      ),
    );
    renderApp('/');
    const user = userEvent.setup();

    await user.upload(await screen.findByLabelText('Attach an image'), [
      new File(['png'], 'a.png', { type: 'image/png' }),
    ]);
    await user.type(screen.getByLabelText('New post'), 'Soon');
    expect(await screen.findByText('Upload failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Post' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(mockDb.posts[0]?.images).toHaveLength(1));
  });

  it('rejects files that are not images without uploading', async () => {
    signedInAs(alice);
    renderApp('/');
    // user-event honours the input's `accept` list unless told otherwise.
    const user = userEvent.setup({ applyAccept: false });

    const file = new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' });
    await user.upload(await screen.findByLabelText('Attach an image'), file);
    expect(
      await screen.findByText('Choose a JPEG, PNG, WebP, GIF or AVIF image.'),
    ).toBeInTheDocument();
    expect(mockDb.uploads).toBe(0);
  });

  it('counts down near the limit and blocks over-long posts', async () => {
    signedInAs(alice);
    renderApp('/');
    const user = userEvent.setup();

    const textarea = await screen.findByLabelText('New post');
    await user.click(textarea);
    await user.paste('x'.repeat(460));
    expect(screen.getByText('40')).toBeInTheDocument();
    await user.paste('x'.repeat(41));
    expect(screen.getByText('-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled();
  });
});
