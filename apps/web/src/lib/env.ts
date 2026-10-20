import { API_BASE_PATH } from '@beso/shared';

/** '' means same origin (Vite proxy in development, Caddy in production). */
export const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
export const API_URL = `${API_ORIGIN}${API_BASE_PATH}`;

/** Who runs this deployment, for the legal pages (build-time, see .env.example). */
export const OPERATOR_NAME =
  import.meta.env.VITE_OPERATOR_NAME?.trim() || 'the operator of this site';
/** Where people can reach the operator; empty means "through the repository". */
export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL?.trim() ?? '';
export const REPOSITORY_URL =
  import.meta.env.VITE_REPOSITORY_URL?.trim() || 'https://github.com/Bodrie/beso';

/**
 * Cloudflare Turnstile site key: with it the register form shows the bot check and sends its
 * token; without it (development, tests) the form is unchanged. Read on each call so tests can
 * stub the environment.
 */
export function getTurnstileSiteKey(): string {
  return import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? '';
}
