import { useSyncExternalStore } from 'react';

/** Chromium's install offer, which the page may hold on to and show later (ADR 0022). */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const isInstallPrompt = (event: Event): event is InstallPromptEvent =>
  'prompt' in event && typeof event.prompt === 'function';

let offer: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const changed = () => {
  for (const listener of listeners) listener();
};

/**
 * Keeps the browser's install offer instead of its mini bar, so Settings and the account menu
 * can make it. Called once from `main.tsx`, before React mounts (the event can come early).
 */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    if (!isInstallPrompt(event)) return;
    event.preventDefault();
    offer = event;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    offer = null;
    changed();
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Whether the browser offers installing the app, and the way to accept the offer. */
export function useInstallPrompt(): { available: boolean; install: () => Promise<void> } {
  const available = useSyncExternalStore(
    subscribe,
    () => offer !== null,
    () => false,
  );
  return {
    available,
    install: async () => {
      const current = offer;
      if (!current) return;
      await current.prompt();
      await current.userChoice;
      // An offer is good for one prompt; the browser makes a new one if it wants to.
      offer = null;
      changed();
    },
  };
}
