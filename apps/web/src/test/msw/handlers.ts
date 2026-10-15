import { authHandlers } from './auth';
import { postHandlers } from './posts';

export { apiError, unauthorized } from './auth';
export { mockDb, resetMockDb as resetMocks, seedPosts, signedInAs } from './db';

export const handlers = [...authHandlers, ...postHandlers];
