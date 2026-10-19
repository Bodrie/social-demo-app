import { hashtagSchema } from '@the-mesh/shared';
import { useParams } from 'react-router';
import { NotFoundPage } from '@/features/not-found/not-found-page';
import { PostList } from '@/features/posts/post-list';
import { usePageTitle } from '@/lib/use-page-title';
import { useTagPosts } from './use-tags';

/** `/tags/:tag`: every post carrying the tag. The address is folded like the parser folds tags. */
export function TagPage() {
  const params = useParams();
  const parsed = hashtagSchema.safeParse(params.tag ?? '');
  return parsed.success ? <TagPosts tag={parsed.data} /> : <NotFoundPage />;
}

function TagPosts({ tag }: { tag: string }) {
  usePageTitle(`#${tag}`);
  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border p-4">
        <h1 className="text-xl font-bold break-all">#{tag}</h1>
        <p className="text-muted-foreground text-sm">Posts tagged #{tag}, newest first.</p>
      </div>
      <PostList
        query={useTagPosts(tag)}
        label={`Posts tagged #${tag}`}
        errorMessage="Could not load these posts."
        empty={{
          title: 'Nothing here yet',
          description: `Be the first to post with #${tag}.`,
        }}
      />
    </div>
  );
}
