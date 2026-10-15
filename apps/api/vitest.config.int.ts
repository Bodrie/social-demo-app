import { defineConfig } from 'vitest/config';

// Integration tests: boot the Nest app against a real PostgreSQL and drive it
// over HTTP (supertest). See test/setup/global-setup.ts for the database.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.int-spec.ts'],
    globalSetup: ['./test/setup/global-setup.ts'],
    setupFiles: ['./test/setup/env.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
