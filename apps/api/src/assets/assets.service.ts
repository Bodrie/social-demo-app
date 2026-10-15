import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';

/** Builds public URLs for storage keys. Records store keys; responses expose URLs. */
@Injectable()
export class AssetsService {
  readonly base: string;

  constructor(config: ConfigService<Env, true>) {
    this.base = config.get('PUBLIC_ASSETS_URL', { infer: true }).replace(/\/+$/, '');
  }

  url(key: string): string {
    return `${this.base}/${key}`;
  }

  maybeUrl(key: string | null): string | null {
    return key === null ? null : this.url(key);
  }
}
