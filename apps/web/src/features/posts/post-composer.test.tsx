import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { alice } from '@/test/fixtures';
import { mockDb, signedInAs } from '@/test/msw/handlers';
import { renderApp } from '@/test/render';

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

    await waitFor(() => expect(mockDb.posts[0]?.imageUrl).toMatch(/uploads\/post\//));
    expect(screen.queryByRole('img', { name: 'Attachment preview' })).not.toBeInTheDocument();
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
