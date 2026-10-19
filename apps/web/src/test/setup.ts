import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { toast } from 'sonner';
import { MockIntersectionObserver } from './intersection-observer';
import { fakeSocket } from './socket-mock';
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
const NodeFormData = Object.getPrototypeOf(nodeFormData).constructor as typeof FormData;
/**
 * Node's FormData refuses a constructor argument, but the browser's accepts a form element and
 * React 19 builds one on a submit whose default was prevented while a transition started
 * (a submit handler that navigates). Mirror the browser: read the form's named controls.
 */
class TestFormData extends NodeFormData {
  constructor(form?: HTMLFormElement | null) {
    super();
    for (const element of form ? Array.from(form.elements) : []) {
      if (
        (element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement) &&
        element.name &&
        !element.disabled
      ) {
        this.append(element.name, element.value);
      }
    }
  }
}
vi.stubGlobal('FormData', TestFormData);
vi.stubGlobal('Blob', NodeBlob);
vi.stubGlobal('File', NodeFile);
window.requestAnimationFrame ??= (callback: FrameRequestCallback) =>
  window.setTimeout(() => callback(0), 0);

// The chat socket never leaves jsdom: every `io()` call returns the shared fake.
vi.mock('socket.io-client', () => ({ io: () => fakeSocket }));

// Dialogs and lazy route chunks take longer when the API and web suites run side by side (CI, `pnpm check`).
configure({ asyncUtilTimeout: 3000 });

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetMocks();
  fakeSocket.reset();
  // Sonner keeps toasts in a module-level store and replays active ones to the next Toaster.
  toast.dismiss();
  window.localStorage.clear();
  document.documentElement.className = '';
});
afterAll(() => server.close());
