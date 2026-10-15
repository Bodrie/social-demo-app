import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { usePageTitle } from '@/lib/use-page-title';

type PagePlaceholderProps = { title: string; description: string };

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  usePageTitle(title);
  return (
    <Card>
      <CardHeader>
        <h1 className="text-xl leading-none font-semibold">{title}</h1>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm">
        This part of the app arrives in a later slice.
      </CardContent>
    </Card>
  );
}
