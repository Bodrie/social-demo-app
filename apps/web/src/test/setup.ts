import '@testing-library/jest-dom/vitest';
import { resetMockSession } from './msw/handlers';
import { server } from './msw/server';

// jsdom lacks a few browser APIs that next-themes and Radix rely on.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}
if (!('ResizeObserver' in window)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverStub });
}
function polyfill(name: string, value: unknown): void {
  if (!(name in Element.prototype)) {
    Object.defineProperty(Element.prototype, name, { configurable: true, writable: true, value });
  }
}
polyfill('scrollIntoView', () => undefined);
polyfill('hasPointerCapture', () => false);
polyfill('setPointerCapture', () => undefined);
polyfill('releasePointerCapture', () => undefined);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetMockSession();
  window.localStorage.clear();
  document.documentElement.className = '';
});
afterAll(() => server.close());
