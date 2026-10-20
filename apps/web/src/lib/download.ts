/** Hands the browser a file to save: a Blob behind a temporary object URL and a click. */
export function saveJsonFile(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // The download has started by now; the URL is not needed any more.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
