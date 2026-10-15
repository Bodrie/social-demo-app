import { inject } from 'vitest';

// Runs inside every integration-test worker, before the test file.
process.env.DATABASE_URL = inject('databaseUrl');
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'integration-test-secret-integration-test-secret';
process.env.COOKIE_SECURE = 'false';
process.env.UPLOADS_DIR = inject('uploadsDir');
