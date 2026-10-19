import { APP_NAME, type Activity } from '@the-mesh/shared';
import { Link } from 'react-router';
import { UserLink } from '@/components/user-link';

/** The quoted text, leading to the post (and to the comment on it) when there is one to open. */
function Excerpt({ text, to }: { text: string; to: string | null }) {
  return to ? (
    <Link to={to} className="text-muted-foreground hover:underline">
      “{text}”
    </Link>
  ) : (
    <span className="text-muted-foreground">“{text}”</span>
  );
}

const postLink = (activity: Activity): string | null =>
  activity.post ? `/p/${activity.post.id}` : null;
const commentLink = (activity: Activity): string | null =>
  activity.post && activity.comment
    ? `/p/${activity.post.id}?comment=${activity.comment.id}`
    : postLink(activity);

/** One sentence describing an activity, with the people in it linked. */
export function ActivityText({ activity }: { activity: Activity }) {
  const actor = <UserLink user={activity.actor} />;
  switch (activity.type) {
    case 'POST_CREATED':
      return (
        <>
          {actor} published a post
          {activity.post ? (
            <>
              : <Excerpt text={activity.post.excerpt} to={postLink(activity)} />
            </>
          ) : null}
        </>
      );
    case 'COMMENT_CREATED':
      return (
        <>
          {actor} commented
          {activity.comment ? (
            <>
              : <Excerpt text={activity.comment.excerpt} to={commentLink(activity)} />
            </>
          ) : null}
        </>
      );
    case 'POST_LIKED':
      return (
        <>
          {actor} liked a post
          {activity.post ? (
            <>
              : <Excerpt text={activity.post.excerpt} to={postLink(activity)} />
            </>
          ) : null}
        </>
      );
    case 'USER_FOLLOWED':
      return (
        <>
          {actor} started following{' '}
          {activity.targetUser ? <UserLink user={activity.targetUser} /> : 'someone'}
        </>
      );
    case 'PROFILE_UPDATED':
      return <>{actor} updated their profile</>;
    case 'USER_REGISTERED':
      return (
        <>
          {actor} joined {APP_NAME}
        </>
      );
    default:
      return null;
  }
}
