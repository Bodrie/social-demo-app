import { APP_NAME } from '@the-mesh/shared';

/**
 * `document.title` has two owners: the page sets its name, the chat sets the unread badge in
 * front of it ("(3) Messages · The Mesh"). Both go through here so neither overwrites the other.
 */
const state = { title: '', badge: 0 };

function apply(): void {
  const name = state.title ? `${state.title} · ${APP_NAME}` : APP_NAME;
  document.title = state.badge > 0 ? `(${state.badge}) ${name}` : name;
}

export function setDocumentTitle(title: string): void {
  state.title = title;
  apply();
}

export function setDocumentBadge(count: number): void {
  state.badge = Math.max(0, Math.trunc(count));
  apply();
}
