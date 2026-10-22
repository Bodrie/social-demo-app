import type { ExploreSort } from '@beso/shared';
import { useSearchParams } from 'react-router';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PostList } from '@/features/posts/post-list';
import { useExplore } from '@/features/posts/use-posts';
import { usePageTitle } from '@/lib/use-page-title';

const TAB_CLASS = 'text-muted-foreground data-[state=active]:text-foreground';

/** `/explore?sort=`: everyone's posts, for a feed that is still quiet (F1). */
export function ExplorePage() {
  usePageTitle('Explore');
  const [params, setParams] = useSearchParams();
  const sort: ExploreSort = params.get('sort') === 'popular' ? 'popular' : 'latest';
  const setSort = (next: string) =>
    setParams(next === 'popular' ? { sort: 'popular' } : {}, { replace: true });

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border p-4">
        <h1 className="text-xl font-bold">Explore</h1>
        <p className="text-muted-foreground text-sm">
          What everyone on BeSo is posting, not only the people you follow.
        </p>
      </div>
      <Tabs value={sort} onValueChange={setSort}>
        <TabsList aria-label="Order">
          <TabsTrigger value="latest" className={TAB_CLASS}>
            Latest
          </TabsTrigger>
          <TabsTrigger value="popular" className={TAB_CLASS}>
            Popular this week
          </TabsTrigger>
        </TabsList>
        <TabsContent value="latest">
          <ExploreList sort="latest" />
        </TabsContent>
        <TabsContent value="popular">
          <ExploreList sort="popular" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExploreList({ sort }: { sort: ExploreSort }) {
  return (
    <PostList
      query={useExplore(sort)}
      label={sort === 'latest' ? 'Latest posts' : 'Popular posts this week'}
      errorMessage="Could not load the posts."
      empty={
        sort === 'latest'
          ? {
              title: 'Nobody has posted yet',
              description: 'Be the first: write something on Home.',
            }
          : {
              title: 'Nothing stood out this week yet',
              description: 'Posts that get liked, discussed and reposted show up here.',
            }
      }
    />
  );
}
