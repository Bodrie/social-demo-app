import { type PresetKind, presetFile } from '@beso/shared/pictures';
import { API_URL } from '@/lib/env';

/**
 * Where the API serves a ready-made picture (ADR 0021, "Rewards"): the address its `avatarUrl`
 * and `coverUrl` give for one. Only lazy screens may import this (it pulls the catalogue in).
 */
export const presetUrl = (kind: PresetKind, id: string): string =>
  `${API_URL}/uploads/preset/${presetFile(kind, id)}`;
