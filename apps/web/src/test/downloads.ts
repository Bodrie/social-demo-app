import { HttpResponse, http } from 'msw/http';
import { server } from './msw/server';

/**
 * Serves the stored pictures (`savePicture` fetches them) and records the names files are saved
 * under instead of letting jsdom follow the download link. Restore with `vi.restoreAllMocks()`.
 */
export function captureDownloads(): string[] {
  const saved: string[] = [];
  server.use(
    http.get('http://localhost/api/v1/uploads/*', () =>
      HttpResponse.arrayBuffer(new Uint8Array([1, 2, 3]).buffer, {
        headers: { 'content-type': 'image/webp' },
      }),
    ),
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push(this.download);
  });
  return saved;
}
