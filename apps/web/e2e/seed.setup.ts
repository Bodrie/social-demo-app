import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { test as setup } from '@playwright/test';

/**
 * Every run starts from the same data: the seed truncates all tables and reloads the
 * demo members, posts, follows and messages (about four seconds). Specs may mutate
 * freely as long as they stay consistent with each other within one run.
 */
setup('reset and seed the database', () => {
  execFileSync('pnpm', ['--filter', '@the-mesh/api', 'db:seed'], {
    cwd: path.resolve(import.meta.dirname, '../../..'),
    stdio: 'inherit',
    timeout: 180_000,
  });
});
