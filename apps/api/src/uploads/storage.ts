import type { Readable } from 'node:stream';

export const STORAGE = Symbol('STORAGE');

/**
 * Where uploaded files live. The local-disk implementation is used today;
 * an S3/R2-compatible one can replace it without touching callers.
 */
export interface StorageService {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** A readable stream of the file, or null when it does not exist. */
  open(key: string): Promise<Readable | null>;
  delete(key: string): Promise<void>;
}
