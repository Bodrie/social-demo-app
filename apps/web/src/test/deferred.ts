/** A promise the test settles by hand, to hold a request or an ack in flight. */
export function deferred(): { promise: Promise<void>; resolve: () => void } {
  const settle: { resolve?: () => void } = {};
  const promise = new Promise<void>((resolve) => {
    settle.resolve = resolve;
  });
  return { promise, resolve: () => settle.resolve?.() };
}
