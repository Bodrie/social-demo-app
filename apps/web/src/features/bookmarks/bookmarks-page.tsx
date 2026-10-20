import { PostList } from '@/features/posts/post-list';
import { useBookmarks } from '@/features/posts/use-posts';
import { usePageTitle } from '@/lib/use-page-title';

/** `/bookmarks`: the viewer's saved posts, newest save first. Private: nobody else's list exists. */
export function BookmarksPage() {
  usePageTitle('Bookmarks');
  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border p-4">
        <h1 className="text-xl font-bold">Bookmarks</h1>
        <p className="text-muted-foreground text-sm">
          Posts you saved for later. Only you can see this list.
        </p>
      </div>
      <PostList
        query={useBookmarks()}
        label="Bookmarks"
        errorMessage="Could not load your bookmarks."
        empty={{
          title: 'Nothing saved yet',
          description: 'Use the bookmark on a post to keep it here.',
        }}
      />
    </div>
  );
}
