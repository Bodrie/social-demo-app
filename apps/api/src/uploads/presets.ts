import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { PRESET_KINDS, type PresetKind, findPreset, presetFile } from '@beso/shared/pictures';

/**
 * The ready-made pictures ship with the API image (`apps/api/presets`, written by `pnpm
 * presets`); they are read-only files of the release, not storage, so they are read here
 * directly rather than through `StorageService`. `src/uploads` and `dist/uploads` both sit two
 * levels below the folder.
 */
export const PRESETS_DIR = path.resolve(import.meta.dirname, '../../presets');

const isPresetKind = (value: string): value is PresetKind =>
  (PRESET_KINDS as readonly string[]).includes(value);

/** The file of a catalogue picture, or null for any other name. */
export async function openPreset(file: string): Promise<Readable | null> {
  const match = /^([a-z]+)-([a-z0-9-]+)\.webp$/.exec(file);
  const kind = match?.[1];
  const id = match?.[2];
  if (!kind || !id || !isPresetKind(kind)) return null;
  const preset = findPreset(kind, id);
  if (!preset) return null;
  const location = path.join(PRESETS_DIR, presetFile(preset.kind, preset.id));
  try {
    await access(location);
  } catch {
    return null;
  }
  return createReadStream(location);
}
