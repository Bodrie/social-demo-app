import type { Revision } from '@the-mesh/shared';
import type { Keyset } from './pagination.js';

type RevisionRow = { id: string; content: string; editedAt: Date };

export function toRevision(row: RevisionRow): Revision {
  return { id: row.id, content: row.content, editedAt: row.editedAt.toISOString() };
}

/** Revisions are listed newest replacement first; the cursor carries `(editedAt, id)` (review L14). */
export function revisionsAfter(cursor: Keyset | undefined) {
  return cursor
    ? {
        OR: [
          { editedAt: { lt: cursor.createdAt } },
          { editedAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      }
    : {};
}

export const revisionKey = (row: { editedAt: Date; id: string }): Keyset => ({
  createdAt: row.editedAt,
  id: row.id,
});
