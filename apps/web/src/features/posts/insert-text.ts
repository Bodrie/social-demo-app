/** Inserts `insert` over the selection [start, end) and returns the new value and caret. */
export function insertText(
  value: string,
  start: number,
  end: number,
  insert: string,
): { value: string; caret: number } {
  const from = Math.max(0, Math.min(start, value.length));
  const to = Math.max(from, Math.min(end, value.length));
  return { value: value.slice(0, from) + insert + value.slice(to), caret: from + insert.length };
}
