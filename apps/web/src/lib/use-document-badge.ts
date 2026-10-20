import { useEffect } from 'react';
import { setDocumentBadge } from './document-title';

/** Puts "(n) " in front of the tab title while `count` is above zero. */
export function useDocumentBadge(count: number): void {
  useEffect(() => {
    setDocumentBadge(count);
    return () => setDocumentBadge(0);
  }, [count]);
}
