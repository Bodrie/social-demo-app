import { defineConfig } from 'tsdown';

// `clean` only for one-off builds: in watch mode wiping dist/ would break
// module resolution in the api and web dev servers that import from it.
const isWatch = process.argv.includes('--watch') || process.argv.includes('-w');

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'neutral',
  dts: true,
  clean: !isWatch,
});
