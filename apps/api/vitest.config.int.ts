import { defineConfig } from 'vitest/config';

// Integration tests: boot the Nest app and drive it over HTTP (supertest).
// A real PostgreSQL will be attached in phase 3a.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.int-spec.ts'],
  },
});
