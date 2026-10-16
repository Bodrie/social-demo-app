/// <reference lib="dom" />
import { expect, test } from '@playwright/test';
import { openHome } from './helpers.js';

test.describe('layout', () => {
  test('opening overlays does not shift the page sideways', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await openHome(page);
    // A plain CSS locator: open overlays hide the rest of the page from the accessibility tree.
    const logo = page.locator('header a[href="/"]').first();
    const before = await logo.boundingBox();
    const widthBefore = await page.evaluate(() => document.documentElement.clientWidth);

    await page.getByRole('button', { name: /account menu/i }).click();
    await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
    expect(await logo.boundingBox()).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.clientWidth)).toBe(widthBefore);
    await page.keyboard.press('Escape');

    await page.goto('/u/alice');
    await page.getByRole('button', { name: 'Edit profile' }).click();
    await expect(page.getByRole('dialog', { name: 'Edit profile' })).toBeVisible();
    expect(await logo.boundingBox()).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.clientWidth)).toBe(widthBefore);
  });

  test('sidebars taller than the viewport scroll on their own', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 560 });
    await openHome(page);
    const sidebar = page.getByRole('complementary', { name: 'Sidebar' });
    await expect(sidebar.getByRole('list', { name: 'Latest activity' })).toBeAttached();
    const scrollable = await sidebar.evaluate((element) => {
      const column = element.parentElement!;
      return (
        getComputedStyle(column).overflowY === 'auto' && column.scrollHeight > column.clientHeight
      );
    });
    expect(scrollable).toBe(true);
  });
});
