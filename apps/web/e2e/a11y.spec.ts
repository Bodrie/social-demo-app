import { AxeBuilder } from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';
import { ANONYMOUS, openHome } from './helpers.js';

/** WCAG 2.1 A/AA checks; `best-practice` rules are left out on purpose (too opinionated for a feed). */
async function audit(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const violations = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? 'n/a'}): ${violation.help}\n` +
      violation.nodes.map((node) => `    ${node.target.join(' ')}`).join('\n'),
  );
  expect(violations, `axe violations on ${label}`).toEqual([]);
}

test.describe('accessibility (signed out)', () => {
  test.use({ storageState: ANONYMOUS });

  test('sign in and register pages', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await audit(page, '/login');
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await audit(page, '/register');
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: 'Forgot your password?' })).toBeVisible();
    await audit(page, '/forgot-password');
    await page.goto('/reset-password?token=axe');
    await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
    await audit(page, '/reset-password');
  });

  test('the waiting room for an unconfirmed address', async ({ page }) => {
    const stamp = Date.now().toString(36);
    await page.goto('/register');
    await page.getByLabel('Username').fill(`axe_${stamp}`);
    await page.getByLabel('Name', { exact: true }).fill('Axe Audit');
    await page.getByLabel('Email').fill(`axe_${stamp}@example.com`);
    await page.getByLabel('Password', { exact: true }).fill('Password123!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
    await audit(page, '/verify-email');
  });
});

test.describe('accessibility (signed in)', () => {
  test('home feed, light and dark', async ({ page }) => {
    await openHome(page);
    await expect(page.getByRole('feed').getByRole('article').first()).toBeVisible();
    await audit(page, '/ (light)');
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await audit(page, '/ (dark)');
  });

  test('people, activity and a profile', async ({ page }) => {
    await openHome(page);
    await page.goto('/users');
    await expect(
      page.getByRole('list', { name: 'People' }).getByRole('listitem').first(),
    ).toBeVisible();
    await audit(page, '/users');
    await page.goto('/activity');
    await expect(
      page.getByRole('list', { name: 'Activity' }).getByRole('listitem').first(),
    ).toBeVisible();
    await audit(page, '/activity');
    await page.goto('/u/bob');
    await expect(page.getByRole('heading', { level: 1, name: 'Bob Brown' })).toBeVisible();
    await audit(page, '/u/bob');
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await audit(page, '/settings');
  });

  test('messages and the edit profile dialog', async ({ page }) => {
    await openHome(page);
    await page.goto('/messages/with/bob');
    await expect(page.getByRole('log', { name: 'Conversation with Bob Brown' })).toBeVisible();
    await audit(page, '/messages (direct)');
    await page
      .getByRole('list', { name: 'Conversations' })
      .getByRole('link', { name: /Weekend plans/ })
      .click();
    await expect(page.getByRole('log', { name: 'Group Weekend plans' })).toBeVisible();
    await audit(page, '/messages (group)');
    await page.getByRole('button', { name: 'Members' }).click();
    await expect(page.getByRole('dialog', { name: 'Weekend plans' })).toBeVisible();
    await audit(page, 'group members dialog');
    await page.keyboard.press('Escape');
    await page.goto('/u/alice');
    await page.getByRole('button', { name: 'Edit profile' }).click();
    await expect(page.getByRole('dialog', { name: 'Edit profile' })).toBeVisible();
    await audit(page, 'edit profile dialog');
  });

  test('keyboard: skip link and focus after navigation', async ({ page }) => {
    await openHome(page);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();

    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'People' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'People' })).toBeVisible();
    await expect(page.locator('#main')).toBeFocused();
  });

  test('unknown addresses keep the shell', async ({ page }) => {
    await openHome(page);
    await page.goto('/no/such/page');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await audit(page, '404');
  });
});
