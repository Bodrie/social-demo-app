import type { StoredImage } from '@beso/shared';
import type { Prisma } from '../generated/prisma/client.js';

/** What a response needs of an upload row to show the picture at its size (D2). */
export const storedImageSelect = {
  key: true,
  width: true,
  height: true,
} satisfies Prisma.UploadSelect;

export type StoredImageRow = Prisma.UploadGetPayload<{ select: typeof storedImageSelect }>;

export const toStoredImage = (row: StoredImageRow, assetsBase: string): StoredImage => ({
  url: `${assetsBase}/${row.key}`,
  width: row.width,
  height: row.height,
});
