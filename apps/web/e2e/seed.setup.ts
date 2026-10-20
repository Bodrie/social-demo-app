import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { test as setup } from '@playwright/test';
import { OUTBOX_DIR } from './helpers.js';

/**
 * Every run starts from the same data: the seed truncates all tables and reloads the
 * demo members, posts, follows and messages (about four seconds). Specs may mutate
 * freely as long as they stay consistent with each other within one run.
 */
setup('reset and seed the database', () => {
  rmSync(OUTBOX_DIR, { recursive: true, force: true });
  execFileSync('pnpm', ['--filter', '@beso/api', 'db:seed'], {
    cwd: path.resolve(import.meta.dirname, '../../..'),
    stdio: 'inherit',
    timeout: 180_000,
  });
});
