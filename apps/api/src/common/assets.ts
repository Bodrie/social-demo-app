/** Storage keys are stored in the database; URLs are built from the public base at read time. */
export function assetUrl(key: string | null, publicBase: string): string | null {
  if (key === null) return null;
  return `${publicBase.replace(/\/+$/, '')}/${key}`;
}
