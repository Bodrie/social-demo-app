const RELOADED_AT = 'the-mesh:reloaded-for-new-version';
/** A new build that fails the same way shows the error page instead of reloading in a loop. */
export const RELOAD_GUARD_MS = 30_000;

/** What browsers say when a lazy chunk of the build this page came from is gone. */
const STALE_CHUNK =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

/** A deploy replaced the build this tab is running (its hashed chunks are gone from the server). */
export function isStaleChunkError(error: unknown): boolean {
  return error instanceof Error && STALE_CHUNK.test(error.message);
}

/**
 * Reloads the page so it runs the new build, unless that was already tried in the last half
 * minute (or there is no session storage to remember it in). Returns whether it reloaded.
 */
export function reloadForNewVersion(reload = () => window.location.reload()): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT) ?? 0);
    if (Date.now() - last < RELOAD_GUARD_MS) return false;
    sessionStorage.setItem(RELOADED_AT, String(Date.now()));
  } catch {
    return false;
  }
  reload();
  return true;
}
