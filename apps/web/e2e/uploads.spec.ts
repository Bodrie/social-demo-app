import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { openHome } from './helpers.js';

test.describe('composer limits', () => {
  test('rejects files that are not images and files above the size limit before uploading', async ({
    page,
  }, testInfo) => {
    await openHome(page);
    const notes = testInfo.outputPath('notes.txt');
    writeFileSync(notes, 'not a picture');
    await page.getByLabel('Attach an image').setInputFiles(notes);
    await expect(page.getByText('Choose a JPEG, PNG, WebP, GIF or AVIF image.')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Attachment preview' })).toHaveCount(0);

    const huge = testInfo.outputPath('huge.png');
    writeFileSync(huge, Buffer.alloc(6 * 1024 * 1024, 1));
    await page.getByLabel('Attach an image').setInputFiles(huge);
    await expect(page.getByText('Images must be 5 MB or smaller.')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Attachment preview' })).toHaveCount(0);
  });

  test('an attached image can be removed again and over-long text cannot be posted', async ({
    page,
  }) => {
    await openHome(page);
    await page
      .getByLabel('Attach an image')
      .setInputFiles(path.join(import.meta.dirname, 'fixtures', 'photo.png'));
    await expect(page.getByRole('img', { name: 'Attachment preview' })).toBeVisible();
    await page.getByRole('button', { name: 'Remove image' }).click();
    await expect(page.getByRole('img', { name: 'Attachment preview' })).toHaveCount(0);

    await page.getByLabel('New post').fill('x'.repeat(501));
    await expect(page.getByText('-1')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Post', exact: true })).toBeDisabled();
  });
});
