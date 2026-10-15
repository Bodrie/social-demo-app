import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const API_PROXY_TARGET = process.env.VITE_DEV_API_URL ?? 'http://localhost:3000';

// Same-origin in development and in `vite preview` (e2e): cookies stay first-party and CORS never applies.
const apiProxy = {
  '/api': { target: API_PROXY_TARGET, changeOrigin: false },
  '/socket.io': { target: API_PROXY_TARGET, ws: true },
};

// Long-lived framework code gets its own chunk so it caches across releases.
const REACT_PACKAGES = ['react', 'react-dom', 'scheduler', 'react-router'];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks cache across releases; the app code changes far more often.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (REACT_PACKAGES.some((name) => id.includes(`/node_modules/${name}/`))) return 'react';
          if (id.includes('socket.io') || id.includes('engine.io')) return 'socket';
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**'],
    css: false,
    // Dialog flows type into several fields; on a loaded CI runner they can pass 5 s.
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
