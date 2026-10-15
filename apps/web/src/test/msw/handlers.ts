import { authHandlers } from './auth';
import { postHandlers } from './posts';
import { userHandlers } from './users';

export { apiError, unauthorized } from './auth';
export { mockDb, resetMockDb as resetMocks, seedFollow, seedPosts, signedInAs } from './db';

// Order matters: posts handlers own `/users/:userId/posts`, users handlers own `/users/:id`.
export const handlers = [...authHandlers, ...postHandlers, ...userHandlers];
