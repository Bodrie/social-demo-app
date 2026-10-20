import { createReadStream } from 'node:fs';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UPLOAD_KEY_PATTERN } from '@beso/shared';
import type { Env } from '../config/env.js';
import type { StorageService } from './storage.js';

/** Files under UPLOADS_DIR, laid out as `<kind>/<uuid>.webp`. Keys never escape the root. */
@Injectable()
export class LocalStorageService implements StorageService {
  private readonly root: string;

  constructor(config: ConfigService<Env, true>) {
    this.root = path.resolve(config.get('UPLOADS_DIR', { infer: true }));
  }

  async put(key: string, data: Buffer, _contentType: string): Promise<void> {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data, { flag: 'wx' });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async open(key: string): Promise<Readable | null> {
    if (!(await this.exists(key))) return null;
    return createReadStream(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  /** Validates the key shape and confines the path to the root directory. */
  private resolve(key: string): string {
    if (!UPLOAD_KEY_PATTERN.test(key)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    const file = path.resolve(this.root, key);
    if (!file.startsWith(this.root + path.sep)) {
      throw new Error(`Storage key escapes the uploads root: ${key}`);
    }
    return file;
  }
}
