import { BadRequestException, Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UploadKind } from '@the-mesh/shared';
import sharp from 'sharp';
import type { Env } from '../config/env.js';

/** Formats sharp may decode for us. SVG is deliberately absent (scripts, external refs). */
export const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'avif']);

type Preset = { width: number; height?: number; fit: 'cover' | 'inside'; quality: number };

export const PRESETS: Record<UploadKind, Preset> = {
  avatar: { width: 512, height: 512, fit: 'cover', quality: 80 },
  cover: { width: 1600, height: 600, fit: 'cover', quality: 80 },
  post: { width: 1920, height: 1920, fit: 'inside', quality: 82 },
};

export type ProcessedImage = { data: Buffer; width: number; height: number; contentType: 'image/webp' };

/**
 * Every upload is decoded by sharp (which trusts magic bytes, not the declared
 * MIME type), auto-rotated, resized per preset and re-encoded to WebP. The
 * re-encode strips EXIF/GPS metadata and neutralises anything that is not pixels.
 */
@Injectable()
export class ImageProcessor {
  private readonly maxPixels: number;

  constructor(config: ConfigService<Env, true>) {
    this.maxPixels = config.get('UPLOAD_MAX_PIXELS', { infer: true });
  }

  async process(input: Buffer, kind: UploadKind): Promise<ProcessedImage> {
    const format = await this.detectFormat(input);
    if (format === undefined || !ACCEPTED_FORMATS.has(format)) {
      throw new UnsupportedMediaTypeException({
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Unsupported image type',
        fields: { file: 'Use a JPEG, PNG, WebP, GIF or AVIF image' },
      });
    }

    const preset = PRESETS[kind];
    try {
      const { data, info } = await sharp(input, { limitInputPixels: this.maxPixels })
        .rotate()
        .resize({
          width: preset.width,
          height: preset.height,
          fit: preset.fit,
          withoutEnlargement: preset.fit === 'inside',
          ...(preset.fit === 'cover' ? { position: 'attention' } : {}),
        })
        .webp({ quality: preset.quality })
        .toBuffer({ resolveWithObject: true });
      return { data, width: info.width, height: info.height, contentType: 'image/webp' };
    } catch (error) {
      throw this.toException(error);
    }
  }

  /** Header-only sniffing; the pixel budget is enforced when the image is actually decoded. */
  private async detectFormat(input: Buffer): Promise<string | undefined> {
    try {
      return (await sharp(input, { limitInputPixels: false }).metadata()).format;
    } catch {
      return undefined;
    }
  }

  private toException(error: unknown): BadRequestException | UnsupportedMediaTypeException {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('pixel limit')) {
      return new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'Image is too large',
        fields: { file: `Images must be below ${Math.round(this.maxPixels / 1_000_000)} megapixels` },
      });
    }
    return new UnsupportedMediaTypeException({
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'The file is not a valid image',
      fields: { file: 'The file could not be decoded as an image' },
    });
  }
}
