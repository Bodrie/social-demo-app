import { API_BASE_PATH } from '@the-mesh/shared';

/** '' means same origin (Vite proxy in development, Caddy in production). */
export const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
export const API_URL = `${API_ORIGIN}${API_BASE_PATH}`;
