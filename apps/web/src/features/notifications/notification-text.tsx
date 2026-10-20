import type { Notification } from '@the-mesh/shared';
import { Excerpt } from '@/features/activities/activity-text';
import { UserLink } from '@/components/user-link';

/** One sentence per notification type, the actor linked and the excerpt leading to the subject. */
export function NotificationText({ notification }: { notification: Notification }) {
  const actor = <UserLink user={notification.actor} />;
  const { post, comment } = notification;
  const postTo = post ? `/p/${post.id}` : null;
  const commentTo = post && comment ? `/p/${post.id}?comment=${comment.id}` : postTo;
  const quotedPost = post ? (
    <>
      : <Excerpt text={post.excerpt} to={postTo} />
    </>
  ) : null;
  const quotedComment = comment ? (
    <>
      : <Excerpt text={comment.excerpt} to={commentTo} />
    </>
  ) : null;
  switch (notification.type) {
    case 'POST_LIKED':
      return (
        <>
          {actor} liked your post{quotedPost}
        </>
      );
    case 'POST_COMMENTED':
      return (
        <>
          {actor} commented on your post{quotedComment}
        </>
      );
    case 'COMMENT_REACTED':
      return (
        <>
          {actor} reacted to your comment{quotedComment}
        </>
      );
    case 'USER_FOLLOWED':
      return <>{actor} started following you</>;
    case 'POST_REPOSTED':
      return (
        <>
          {actor} reposted your post{quotedPost}
        </>
      );
    case 'POST_QUOTED':
      return (
        <>
          {actor} quoted your post{quotedPost}
        </>
      );
    case 'MENTIONED_IN_POST':
      return (
        <>
          {actor} mentioned you in a post{quotedPost}
        </>
      );
    case 'MENTIONED_IN_COMMENT':
      return (
        <>
          {actor} mentioned you in a comment{quotedComment}
        </>
      );
    default:
      return null;
  }
}
