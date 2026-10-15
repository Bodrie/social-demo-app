import { inject } from 'vitest';

// Runs inside every integration-test worker, before the test file.
process.env.DATABASE_URL = inject('databaseUrl');
process.env.NODE_ENV = 'test';
