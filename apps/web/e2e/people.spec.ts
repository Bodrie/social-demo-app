import { expect, test } from '@playwright/test';
import { openHome } from './helpers.js';

test.describe('people and activity', () => {
  test('search for a member and open their profile', async ({ page }) => {
    await openHome(page);
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'People' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'People' })).toBeVisible();

    await page.getByRole('searchbox', { name: 'Search people' }).fill('carol');
    const results = page.getByRole('list', { name: 'Results for carol' });
    await expect(results.getByRole('link', { name: 'Carol Clark' })).toBeVisible();
    await expect(page).toHaveURL(/\?q=carol$/);

    await results.getByRole('link', { name: 'Carol Clark' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Carol Clark' })).toBeVisible();
  });

  test('sidebar shows suggestions and activity, and the activity page lists more', async ({
    page,
  }) => {
    await openHome(page);
    const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
    await expect(
      sidebar.getByRole('list', { name: 'Suggestions' }).getByRole('listitem').first(),
    ).toBeVisible();
    await expect(
      sidebar.getByRole('list', { name: 'Latest activity' }).getByRole('listitem').first(),
    ).toBeVisible();

    await sidebar.getByRole('link', { name: 'See all' }).nth(1).click();
    await expect(page).toHaveURL(/\/activity$/);
    await expect(
      page.getByRole('list', { name: 'Activity' }).getByRole('listitem').first(),
    ).toBeVisible();
  });
});
