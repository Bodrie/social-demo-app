import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ACHIEVEMENT_BY_KEY } from '@beso/shared/achievements';
import { PRESETS, presetFile } from '@beso/shared/pictures';
import { PRESETS_DIR } from './presets.js';

describe('ready-made pictures', () => {
  it('have a file for every catalogue entry, and only those', () => {
    const expected = PRESETS.map((preset) => presetFile(preset.kind, preset.id)).toSorted();
    for (const file of expected) expect(existsSync(path.join(PRESETS_DIR, file))).toBe(true);
    expect(
      readdirSync(PRESETS_DIR)
        .filter((file) => file.endsWith('.webp'))
        .toSorted(),
    ).toEqual(expected);
  });

  it('are unlocked by badges that exist', () => {
    for (const preset of PRESETS) {
      if (preset.unlockedBy !== null) expect(ACHIEVEMENT_BY_KEY.has(preset.unlockedBy)).toBe(true);
    }
  });
});
