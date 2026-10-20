import { type RouteObject, createBrowserRouter, createMemoryRouter } from 'react-router';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { AppShell } from '@/components/layout/app-shell';
import { LoginPage } from '@/features/auth/login-page';
import { RegisterPage } from '@/features/auth/register-page';
import { VerifyEmailPage } from '@/features/auth/verify-email-page';
import { HomePage } from '@/features/feed/home-page';
import { RedirectIfAuthenticated, RequireAuth } from './routes/require-auth';
import { RouteError } from './routes/route-error';

type ProfileRoutes = typeof import('@/features/profile/routes');
type ChatRoutes = typeof import('@/features/chat/routes');
type LegalRoutes = typeof import('@/features/legal/routes');

/** Picks one component out of a feature's route module; the module itself is one shared chunk. */
const profile = (name: keyof ProfileRoutes) => async () => ({
  Component: (await import('@/features/profile/routes'))[name],
});
const chat = (name: keyof ChatRoutes) => async () => ({
  Component: (await import('@/features/chat/routes'))[name],
});
const legal = (name: keyof LegalRoutes) => async () => ({
  Component: (await import('@/features/legal/routes'))[name],
});

/**
 * The shell, the home feed and the auth pages ship in the entry chunk; every other
 * page is loaded on first visit (`lazy`). The spinner covers a direct load of a lazy
 * address; later navigations keep the current page until the chunk is ready.
 */
export const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    hydrateFallbackElement: <FullPageSpinner label="Loading" />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <HomePage /> },
              {
                path: 'users',
                lazy: async () => ({
                  Component: (await import('@/features/users/users-page')).UsersPage,
                }),
              },
              {
                path: 'settings',
                lazy: async () => ({
                  Component: (await import('@/features/settings/settings-page')).SettingsPage,
                }),
              },
              {
                path: 'activity',
                lazy: async () => ({
                  Component: (await import('@/features/activities/activity-page')).ActivityPage,
                }),
              },
              {
                path: 'admin',
                lazy: async () => ({
                  Component: (await import('@/features/admin/admin-page')).AdminPage,
                }),
              },
              {
                path: 'bookmarks',
                lazy: async () => ({
                  Component: (await import('@/features/bookmarks/bookmarks-page')).BookmarksPage,
                }),
              },
              {
                path: 'notifications',
                lazy: async () => ({
                  Component: (await import('@/features/notifications/notifications-page'))
                    .NotificationsPage,
                }),
              },
              {
                path: 'messages',
                lazy: chat('MessagesPage'),
                handle: { wide: true },
                children: [
                  { index: true, lazy: chat('MessagesIndex') },
                  { path: 'with/:username', lazy: chat('WithUserPage') },
                  { path: ':conversationId', lazy: chat('ThreadPage') },
                ],
              },
              {
                path: 'p/:postId',
                lazy: async () => ({
                  Component: (await import('@/features/posts/post-page')).PostPage,
                }),
              },
              {
                path: 'search',
                lazy: async () => ({
                  Component: (await import('@/features/search/search-page')).SearchPage,
                }),
              },
              {
                path: 'tags/:tag',
                lazy: async () => ({
                  Component: (await import('@/features/tags/tag-page')).TagPage,
                }),
              },
              {
                path: 'u/:username',
                lazy: profile('ProfilePage'),
                children: [
                  { index: true, lazy: profile('ProfilePosts') },
                  { path: 'followers', lazy: profile('ProfileFollowers') },
                  { path: 'following', lazy: profile('ProfileFollowing') },
                ],
              },
              {
                path: '*',
                lazy: async () => ({
                  Component: (await import('@/features/not-found/not-found-page')).NotFoundPage,
                }),
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
          {
            path: 'forgot-password',
            lazy: async () => ({
              Component: (await import('@/features/auth/forgot-password-page')).ForgotPasswordPage,
            }),
          },
        ],
      },
      // Open to everyone: the mailed links are followed signed in or not.
      { path: 'verify-email', element: <VerifyEmailPage /> },
      { path: 'privacy', lazy: legal('PrivacyPage') },
      { path: 'terms', lazy: legal('TermsPage') },
      {
        path: 'reset-password',
        lazy: async () => ({
          Component: (await import('@/features/auth/reset-password-page')).ResetPasswordPage,
        }),
      },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);

/** For tests: same route tree, in-memory history. */
export const createTestRouter = (initialEntries: string[] = ['/']) =>
  createMemoryRouter(routes, { initialEntries });
