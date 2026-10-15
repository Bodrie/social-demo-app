import { PostComposer } from '@/features/posts/post-composer';
import { usePageTitle } from '@/lib/use-page-title';
import { Feed } from './feed';

export function HomePage() {
  usePageTitle('Home');
  return (
    <div className="space-y-4">
      <h1 className="sr-only">Home</h1>
      <PostComposer />
      <Feed />
    </div>
  );
}
