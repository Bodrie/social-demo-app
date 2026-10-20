import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { RichText } from './rich-text';

describe('RichText', () => {
  it('links only the mentions the server resolved', () => {
    renderWithProviders(
      <RichText text="Hi @Alice and @ghost" mentions={[{ username: 'alice' }]} />,
    );
    expect(screen.getByRole('link', { name: '@Alice' })).toHaveAttribute('href', '/u/alice');
    expect(screen.queryByRole('link', { name: '@ghost' })).toBeNull();
    expect(screen.getByText(/and @ghost/)).toBeInTheDocument();
  });

  it('links hashtags to their page when asked, folded to lower case', () => {
    const { unmount } = renderWithProviders(<RichText text="Plans for the #Weekend" hashtags />);
    expect(screen.getByRole('link', { name: '#Weekend' })).toHaveAttribute('href', '/tags/weekend');
    unmount();
    renderWithProviders(<RichText text="Plans for the #Weekend" />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('opens links in a new tab with a shortened label and the full address as title', () => {
    renderWithProviders(<RichText text="See https://example.com/some/path/. Nice" />);
    const link = screen.getByRole('link', { name: 'example.com/some/path' });
    expect(link).toHaveAttribute('href', 'https://example.com/some/path/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAttribute('title', 'https://example.com/some/path/');
    expect(screen.getByText(/\. Nice$/)).toBeInTheDocument();
  });

  it('shortens long addresses in the label only', () => {
    const url = `https://example.com/${'a'.repeat(60)}`;
    renderWithProviders(<RichText text={url} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', url);
    expect(link.textContent).toHaveLength(48);
    expect(link.textContent?.endsWith('…')).toBe(true);
  });

  it('leaves email addresses alone', () => {
    renderWithProviders(<RichText text="write to mail@example.com" mentions={[]} />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
