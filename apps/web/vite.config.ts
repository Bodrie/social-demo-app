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

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**'],
    css: false,
  },
});
