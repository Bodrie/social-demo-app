import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';
import { loadTurnstile } from './turnstile-loader';

type TurnstileProps = {
  siteKey: string;
  /** A fresh token, or null when it expired, failed or was reset. */
  onToken: (token: string | null) => void;
  /** Bump to reset the widget (tokens are single-use: after a refused registration). */
  resetSignal: number;
  /** A problem reported by the server for the token, shown under the widget. */
  error?: string | null;
};

/** The Cloudflare Turnstile bot check, following the app's theme. */
export function Turnstile({ siteKey, onToken, resetSignal, error }: TurnstileProps) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [failed, setFailed] = useState(false);
  // The widget's callbacks were handed to Cloudflare once; they read the latest handler here.
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let cancelled = false;
    const mount = async () => {
      try {
        const api = await loadTurnstile();
        const container = containerRef.current;
        if (cancelled || !container) return;
        widgetRef.current = api.render(container, {
          sitekey: siteKey,
          theme: resolvedTheme === 'dark' ? 'dark' : 'light',
          size: 'flexible',
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => {
            onTokenRef.current(null);
            setFailed(true);
          },
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    void mount();
    return () => {
      cancelled = true;
      if (widgetRef.current) {
        window.turnstile?.remove(widgetRef.current);
        widgetRef.current = null;
      }
      onTokenRef.current(null);
    };
  }, [siteKey, resolvedTheme]);

  useEffect(() => {
    if (resetSignal === 0 || !widgetRef.current) return;
    window.turnstile?.reset(widgetRef.current);
    onTokenRef.current(null);
  }, [resetSignal]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} data-testid="turnstile" className="min-h-16" />
      {failed ? (
        <p className="text-destructive text-sm" role="alert">
          The bot check could not load. Reload the page to try again.
        </p>
      ) : error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
