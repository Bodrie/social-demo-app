import { useNavigation } from 'react-router';

/** A thin bar at the very top while the router is loading a page chunk or data. */
export function NavigationProgress() {
  const navigation = useNavigation();
  if (navigation.state === 'idle') return null;
  return (
    // Decorative: the new page's content is the real feedback for assistive tech.
    <div aria-hidden="true" className="nav-progress bg-primary fixed inset-x-0 top-0 z-50 h-0.5" />
  );
}
