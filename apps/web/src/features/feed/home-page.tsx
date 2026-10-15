import { useCurrentUser } from '@/features/auth/current-user';
import { PagePlaceholder } from '@/components/page-placeholder';

export function HomePage() {
  const user = useCurrentUser();
  return (
    <PagePlaceholder
      title={`Welcome back, ${user.name}`}
      description="Your feed will appear here."
    />
  );
}
