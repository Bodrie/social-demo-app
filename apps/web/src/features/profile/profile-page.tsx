import { useParams } from 'react-router';
import { PagePlaceholder } from '@/components/page-placeholder';

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  return (
    <PagePlaceholder title={`@${username ?? ''}`} description="Profile, posts and followers." />
  );
}
