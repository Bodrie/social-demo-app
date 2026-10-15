import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router';
import { AppShell } from '@/components/layout/app-shell';
import { LoginPage } from '@/features/auth/login-page';
import { RegisterPage } from '@/features/auth/register-page';
import { HomePage } from '@/features/feed/home-page';
import { MessagesPage } from '@/features/messages/messages-page';
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
              { path: 'messages', element: <MessagesPage /> },
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
