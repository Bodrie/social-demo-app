/** Where to go after signing in: the in-app path the guard recorded, never an external URL. */
export function redirectTarget(state: unknown): string {
  if (
    typeof state === 'object' &&
    state !== null &&
    'from' in state &&
    typeof state.from === 'string'
  ) {
    return state.from.startsWith('/') && !state.from.startsWith('//') ? state.from : '/';
  }
  return '/';
}
