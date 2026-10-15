import { APP_NAME } from '@the-mesh/shared';
import { useEffect } from 'react';

/** Sets `document.title` to "<title> · The Mesh" while the component is mounted. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}
