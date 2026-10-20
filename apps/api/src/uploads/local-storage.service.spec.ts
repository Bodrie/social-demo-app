import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { LocalStorageService } from './local-storage.service.js';

const KEY = 'avatar/01a13ed6-d3ec-71cb-b39f-fbc256a293b9.webp';

describe('LocalStorageService', () => {
  let root: string;
  let storage: LocalStorageService;

  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'beso-storage-'));
    storage = new LocalStorageService({ get: () => root } as unknown as ConfigService<Env, true>);
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('writes, finds, streams and deletes a file under the root', async () => {
    await storage.put(KEY, Buffer.from('webp-bytes'), 'image/webp');
    expect(await storage.exists(KEY)).toBe(true);

    const stream = await storage.open(KEY);
    const chunks: Buffer[] = [];
    for await (const chunk of stream ?? []) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe('webp-bytes');

    await storage.delete(KEY);
    expect(await storage.exists(KEY)).toBe(false);
    expect(await storage.open(KEY)).toBeNull();
  });

  it('refuses keys that do not match the layout or try to escape the root', async () => {
    const bad = ['avatar/../../etc/passwd', '../x.webp', 'avatar/x.webp', '/etc/passwd'];
    await Promise.all(
      bad.map((key) =>
        expect(storage.put(key, Buffer.alloc(1), 'image/webp')).rejects.toThrow(
          /Invalid storage key/,
        ),
      ),
    );
    expect(await Promise.all(bad.map((key) => storage.exists(key)))).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});
