import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router';
import { AppShell } from '@/components/layout/app-shell';
import { LoginPage } from '@/features/auth/login-page';
import { RegisterPage } from '@/features/auth/register-page';
import { ActivityPage } from '@/features/activities/activity-page';
import { MessagesIndex, MessagesPage } from '@/features/chat/messages-page';
import { ThreadPage } from '@/features/chat/thread-page';
import { HomePage } from '@/features/feed/home-page';
import { ProfileFollowers, ProfileFollowing } from '@/features/profile/profile-followers';
import { ProfilePage } from '@/features/profile/profile-page';
import { ProfilePosts } from '@/features/profile/profile-posts';
import { UsersPage } from '@/features/users/users-page';
import { RedirectIfAuthenticated, RequireAuth } from './routes/require-auth';
import { RouteError } from './routes/route-error';

export const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <HomePage /> },
              { path: 'users', element: <UsersPage /> },
              { path: 'activity', element: <ActivityPage /> },
              {
                path: 'messages',
                element: <MessagesPage />,
                handle: { wide: true },
                children: [
                  { index: true, element: <MessagesIndex /> },
                  { path: ':username', element: <ThreadPage /> },
                ],
              },
              {
                path: 'u/:username',
                element: <ProfilePage />,
                children: [
                  { index: true, element: <ProfilePosts /> },
                  { path: 'followers', element: <ProfileFollowers /> },
                  { path: 'following', element: <ProfileFollowing /> },
                ],
              },
            ],
          },
        ],
      },
      {
        element: <RedirectIfAuthenticated />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
        ],
      },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);

/** For tests: same route tree, in-memory history. */
export const createTestRouter = (initialEntries: string[] = ['/']) =>
  createMemoryRouter(routes, { initialEntries });
