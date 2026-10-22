import { createECDH } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';
import { OUTBOX_DIR, STORAGE_STATE } from './e2e/helpers.js';

const WEB_PORT = 4173;
const API_PORT = 3000;
const isCI = Boolean(process.env.CI);

/**
 * A throwaway VAPID pair, so the API has web push switched on and the app registers its service
 * worker (ADR 0022); nothing is ever pushed. P-256, base64url, the private key padded to 32 bytes
 * as web-push does it.
 */
const vapid = createECDH('prime256v1');
vapid.generateKeys();
const privateKey = vapid.getPrivateKey();
const VAPID_ENV = {
  VAPID_PUBLIC_KEY: vapid.getPublicKey('base64url'),
  VAPID_PRIVATE_KEY: Buffer.concat([Buffer.alloc(32 - privateKey.length), privateKey]).toString(
    'base64url',
  ),
  VAPID_SUBJECT: 'mailto:e2e@example.com',
};

/**
 * End-to-end tests run against the real API and a seeded PostgreSQL
 * (alice/bob/carol, password Password123!). Both servers are started here:
 * the API from its build output, the web app via `vite preview`, which
 * proxies /api and /socket.io to the API so cookies stay first-party.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    // 1. Reset the data, 2. store a session per seeded member, 3. run the specs as alice
    //    (specs needing another member open a second context with `contextAs`; specs that
    //    must start signed out use `test.use({ storageState: ANONYMOUS })`).
    { name: 'seed', testMatch: /seed\.setup\.ts/ },
    { name: 'setup', testMatch: /auth\.setup\.ts/, dependencies: ['seed'] },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      command: 'node dist/main.js',
      cwd: '../api',
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !isCI,
      timeout: 60_000,
      env: {
        PORT: String(API_PORT),
        WEB_ORIGINS: `http://localhost:${WEB_PORT}`,
        // Mailed links must point at the preview server; the outbox is what the specs read.
        WEB_URL: `http://localhost:${WEB_PORT}`,
        EMAIL_TRANSPORT: 'outbox',
        EMAIL_OUTBOX_DIR: OUTBOX_DIR,
        LOG_LEVEL: process.env.E2E_API_LOG_LEVEL ?? 'warn',
        // Every worker is signed in as alice, so the per-user socket limits meant for one
        // person's tabs would refuse her handshakes in a full run (`Too many connections`:
        // messages still go out over HTTP, but pushes such as read receipts never arrive).
        SOCKET_MAX_PER_USER: '50',
        SOCKET_CONNECTS_PER_MINUTE: '1000',
        // The seed makes alice an admin; the list keeps her one across API restarts.
        ADMIN_EMAILS: 'alice@example.com',
        // The global limit counts per route and address, and every browser reaches the API
        // from the preview proxy's address: a full run asks GET /auth/me ~100 times a minute,
        // and the 429s that follow leave every later page without a session.
        THROTTLE_LIMIT: '10000',
        ...VAPID_ENV,
      },
    },
    {
      command: `pnpm exec vite preview --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
  ],
});
