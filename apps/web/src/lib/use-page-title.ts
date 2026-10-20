import { useEffect } from 'react';
import { setDocumentTitle } from './document-title';

/** Sets `document.title` to "<title> · BeSo" (behind the unread badge) while the component is mounted. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    setDocumentTitle(title);
  }, [title]);
}
