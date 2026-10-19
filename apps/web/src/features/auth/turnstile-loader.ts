/** The part of Cloudflare's explicit-rendering API that the widget uses. */
export type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: 'light' | 'dark' | 'auto';
      size?: 'normal' | 'flexible' | 'compact';
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: (code?: string) => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<TurnstileApi> | undefined;

/** Loads Cloudflare's script once, on first use; a stub on `window.turnstile` short-circuits it. */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener(
      'load',
      () => {
        if (window.turnstile) resolve(window.turnstile);
        else reject(new Error('Turnstile did not initialise'));
      },
      { once: true },
    );
    script.addEventListener(
      'error',
      () => {
        loading = undefined;
        reject(new Error('Turnstile could not be loaded'));
      },
      { once: true },
    );
    document.head.append(script);
  });
  return loading;
}
