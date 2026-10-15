import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UploadKind, UploadResponse } from '@the-mesh/shared';
import { assetUrl } from '../common/assets.js';
import type { Env } from '../config/env.js';
import { ImageProcessor } from './image-processor.js';
import { STORAGE, type StorageService } from './storage.js';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly assetsBase: string;

  constructor(
    @Inject(STORAGE) private readonly storage: StorageService,
    private readonly images: ImageProcessor,
    config: ConfigService<Env, true>,
  ) {
    this.assetsBase = config.get('PUBLIC_ASSETS_URL', { infer: true });
  }

  async upload(kind: UploadKind, input: Buffer): Promise<UploadResponse> {
    const image = await this.images.process(input, kind);
    const key = `${kind}/${randomUUID()}.webp`;
    await this.storage.put(key, image.data, image.contentType);
    return {
      key,
      url: assetUrl(key, this.assetsBase) ?? '',
      width: image.width,
      height: image.height,
      bytes: image.data.length,
    };
  }

  open(key: string): Promise<Readable | null> {
    return this.storage.open(key);
  }

  /** For references stored on other records (avatarKey, post imageKey). */
  async assertExists(key: string, field: string): Promise<void> {
    if (!(await this.storage.exists(key))) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Unknown upload',
        fields: { [field]: 'Unknown upload' },
      });
    }
  }

  /** Best-effort removal of a file that is no longer referenced. */
  async discard(key: string | null): Promise<void> {
    if (key === null) return;
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.warn({ err: error, key }, 'Could not delete upload');
    }
  }
}
