import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** Suggestions, activities and online users land here in the next slices. */
export function RightBar() {
  return (
    <aside aria-label="Sidebar" className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Suggestions for you</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Coming with the people slice.
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Latest activities</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Coming with the activities slice.
        </CardContent>
      </Card>
    </aside>
  );
}
