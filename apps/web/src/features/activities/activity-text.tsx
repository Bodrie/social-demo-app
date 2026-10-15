import { APP_NAME, type Activity } from '@the-mesh/shared';
import { UserLink } from '@/components/user-link';

function Excerpt({ text }: { text: string }) {
  return <span className="text-muted-foreground">“{text}”</span>;
}

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
              : <Excerpt text={activity.post.excerpt} />
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
              : <Excerpt text={activity.comment.excerpt} />
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
              : <Excerpt text={activity.post.excerpt} />
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
