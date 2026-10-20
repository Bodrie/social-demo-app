import { screen } from '@testing-library/react';
import { makeNotification, testId } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { NotificationText } from './notification-text';

describe('NotificationText', () => {
  it('describes every notification type with the actor linked and the subject quoted', () => {
    const post = { id: testId('post', 1), excerpt: 'Hello world' };
    const comment = { id: testId('comment', 1), excerpt: 'Nice!' };
    const types = [
      makeNotification('POST_LIKED', { post }),
      makeNotification('POST_COMMENTED', { post, comment }),
      makeNotification('COMMENT_REACTED', { post, comment }),
      makeNotification('USER_FOLLOWED'),
      makeNotification('MENTIONED_IN_POST', { post }),
      makeNotification('MENTIONED_IN_COMMENT', { post, comment }),
    ];
    renderWithProviders(
      <ul>
        {types.map((notification) => (
          <li key={notification.id}>
            <NotificationText notification={notification} />
          </li>
        ))}
      </ul>,
    );

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Bob Brown liked your post: “Hello world”',
      'Bob Brown commented on your post: “Nice!”',
      'Bob Brown reacted to your comment: “Nice!”',
      'Bob Brown started following you',
      'Bob Brown mentioned you in a post: “Hello world”',
      'Bob Brown mentioned you in a comment: “Nice!”',
    ]);
    expect(screen.getAllByRole('link', { name: 'Bob Brown' })).toHaveLength(6);
    expect(screen.getAllByRole('link', { name: '“Nice!”' })[0]).toHaveAttribute(
      'href',
      `/p/${post.id}?comment=${comment.id}`,
    );
  });
});
