import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 4173;
const API_PORT = 3000;
const isCI = Boolean(process.env.CI);

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
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
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
        LOG_LEVEL: process.env.E2E_API_LOG_LEVEL ?? 'warn',
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
