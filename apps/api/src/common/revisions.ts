import type { Revision } from '@the-mesh/shared';

type RevisionRow = { id: string; content: string; editedAt: Date };

export function toRevision(row: RevisionRow): Revision {
  return { id: row.id, content: row.content, editedAt: row.editedAt.toISOString() };
}
