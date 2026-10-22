import { activityHandlers } from './activities';
import { adminHandlers } from './admin';
import { conversationHandlers } from './conversations';
import { authHandlers } from './auth';
import { notificationHandlers } from './notifications';
import { postHandlers } from './posts';
import { pushHandlers } from './push';
import { tagHandlers } from './tags';
import { userHandlers } from './users';

export { apiError, unauthorized } from './auth';
export { mockDb, resetMockDb as resetMocks, seedFollow, seedPosts, signedInAs } from './db';

// Order matters: posts handlers own `/users/:userId/posts`, users handlers own `/users/:id`.
export const handlers = [
  ...authHandlers,
  ...postHandlers,
  ...userHandlers,
  ...activityHandlers,
  ...notificationHandlers,
  ...adminHandlers,
  ...conversationHandlers,
  ...tagHandlers,
  ...pushHandlers,
];
