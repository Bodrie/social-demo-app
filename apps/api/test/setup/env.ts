import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inject } from 'vitest';

// Runs inside every integration-test worker, before the test file.
process.env.DATABASE_URL = inject('databaseUrl');
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'integration-test-secret-integration-test-secret';
process.env.COOKIE_SECURE = 'false';
process.env.UPLOADS_DIR = inject('uploadsDir');
process.env.EMAIL_TRANSPORT = 'outbox';
process.env.EMAIL_OUTBOX_DIR = mkdtempSync(path.join(os.tmpdir(), 'mesh-outbox-'));
process.env.WEB_URL = 'http://localhost:5173';
