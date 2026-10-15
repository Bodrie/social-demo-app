import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

/**
 * Integration-test database.
 * - `TEST_DATABASE_URL` set (CI): use that database. `DATABASE_URL` is deliberately
 *   ignored so a developer's dev database can never be truncated by tests.
 * - Otherwise (local): start a throwaway Postgres 17 container with Testcontainers
 *   (requires Docker).
 * Migrations are applied once per run; test files reset the tables themselves.
 */
let container: StartedPostgreSqlContainer | undefined;
let uploadsDir: string | undefined;

export async function setup(project: TestProject): Promise<void> {
  let databaseUrl = process.env.TEST_DATABASE_URL;

  if (!databaseUrl) {
    // Only public images are pulled, so registry credentials are never needed.
    // Skipping Docker's credential helpers also avoids a hard failure on WSL,
    // where Docker Desktop registers a Windows helper that Linux cannot spawn.
    // Testcontainers reads this at import time, hence the dynamic import below.
    process.env.DOCKER_AUTH_CONFIG ??= JSON.stringify({ auths: {} });
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');

    container = await new PostgreSqlContainer('postgres:17-alpine')
      .withDatabase('mesh_test')
      .start();
    databaseUrl = container.getConnectionUri();
  }

  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  project.provide('databaseUrl', databaseUrl);

  uploadsDir = await mkdtemp(path.join(os.tmpdir(), 'mesh-uploads-'));
  project.provide('uploadsDir', uploadsDir);
}

export async function teardown(): Promise<void> {
  await container?.stop();
  if (uploadsDir) await rm(uploadsDir, { recursive: true, force: true });
}
