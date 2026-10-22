import { defineConfig } from 'tsdown';

// `clean` only for one-off builds: in watch mode wiping dist/ would break
// module resolution in the api and web dev servers that import from it.
const isWatch = process.argv.includes('--watch') || process.argv.includes('-w');

export default defineConfig({
  // Achievements are an entry of their own, so the web loads them lazily (F2, ADR 0021).
  entry: { index: 'src/index.ts', achievements: 'src/achievements.ts' },
  format: ['esm'],
  platform: 'neutral',
  dts: true,
  clean: !isWatch,
});
