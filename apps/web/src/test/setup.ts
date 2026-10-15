import '@testing-library/jest-dom/vitest';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { MockIntersectionObserver } from './intersection-observer';
import { resetMocks } from './msw/handlers';
import { server } from './msw/server';

// jsdom lacks a few browser APIs that next-themes, Radix and the uploader rely on.
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
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
});
function polyfill(name: string, value: unknown): void {
  if (!(name in Element.prototype)) {
    Object.defineProperty(Element.prototype, name, { configurable: true, writable: true, value });
  }
}
polyfill('scrollIntoView', () => undefined);
polyfill('hasPointerCapture', () => false);
polyfill('setPointerCapture', () => undefined);
polyfill('releasePointerCapture', () => undefined);
// Vitest's own createObjectURL shim chokes on cross-realm files; a fake URL is all the UI needs.
let objectUrlCounter = 0;
Object.defineProperty(URL, 'createObjectURL', {
  configurable: true,
  writable: true,
  value: () => `blob:mock-${++objectUrlCounter}`,
});
Object.defineProperty(URL, 'revokeObjectURL', {
  configurable: true,
  writable: true,
  value: () => undefined,
});

// MSW runs requests through Node's fetch, which only understands its own FormData/Blob/File;
// jsdom's wrappers would be stringified. Use Node's for all three.
const nodeFormData = await new Response('', {
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
}).formData();
vi.stubGlobal('FormData', Object.getPrototypeOf(nodeFormData).constructor);
vi.stubGlobal('Blob', NodeBlob);
vi.stubGlobal('File', NodeFile);
window.requestAnimationFrame ??= (callback: FrameRequestCallback) =>
  window.setTimeout(() => callback(0), 0);

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetMocks();
  window.localStorage.clear();
  document.documentElement.className = '';
});
afterAll(() => server.close());
