import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { UploadKind, UploadResponse } from '@the-mesh/shared';
import { AssetsService } from '../assets/assets.service.js';
import { badRequest } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ImageProcessor } from './image-processor.js';
import { STORAGE, type StorageService } from './storage.js';

export type OwnershipCheck = { ownerId: string; kind: UploadKind; field: string };

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    @Inject(STORAGE) private readonly storage: StorageService,
    private readonly images: ImageProcessor,
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  async upload(kind: UploadKind, input: Buffer, ownerId: string): Promise<UploadResponse> {
    const image = await this.images.process(input, kind);
    const key = `${kind}/${randomUUID()}.webp`;
    await this.storage.put(key, image.data, image.contentType);
    await this.prisma.upload.create({ data: { key, ownerId, kind } });
    return {
      key,
      url: this.assets.url(key),
      width: image.width,
      height: image.height,
      bytes: image.data.length,
    };
  }

  open(key: string): Promise<Readable | null> {
    return this.storage.open(key);
  }

  /**
   * A key may only be attached by the user who uploaded it, and only where its
   * kind fits. Unknown, foreign and wrong-kind keys all get the same answer.
   */
  async assertOwned(key: string, check: OwnershipCheck): Promise<void> {
    const upload = await this.prisma.upload.findUnique({
      where: { key },
      select: { ownerId: true, kind: true },
    });
    if (!upload || upload.ownerId !== check.ownerId || upload.kind !== check.kind) {
      throw badRequest('Unknown upload', { [check.field]: 'Unknown upload' });
    }
  }

  /** Deletes a file once nothing references it any more. Best effort, never throws. */
  async discard(key: string | null): Promise<void> {
    if (key === null) return;
    try {
      const [profiles, posts] = await Promise.all([
        this.prisma.user.count({ where: { OR: [{ avatarKey: key }, { coverKey: key }] } }),
        this.prisma.post.count({ where: { imageKey: key } }),
      ]);
      if (profiles + posts > 0) return;
      await this.storage.delete(key);
      await this.prisma.upload.deleteMany({ where: { key } });
    } catch (error) {
      this.logger.warn({ err: error, key }, 'Could not discard upload');
    }
  }
}
