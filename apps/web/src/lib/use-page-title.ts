import { useEffect } from 'react';
import { setDocumentTitle } from './document-title';

/** Sets `document.title` to "<title> · The Mesh" (behind the unread badge) while the component is mounted. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    setDocumentTitle(title);
  }, [title]);
}
