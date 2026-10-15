import { screen } from '@testing-library/react';
import { carol, makeActivity, summaryOf } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { ActivityText } from './activity-text';

describe('ActivityText', () => {
  it('describes every activity type with the people linked', () => {
    const post = { id: '01a13f00-0000-7000-8000-000000000001', excerpt: 'Hello world' };
    renderWithProviders(
      <ul>
        <li>
          <ActivityText activity={makeActivity('POST_CREATED', { post })} />
        </li>
        <li>
          <ActivityText
            activity={makeActivity('COMMENT_CREATED', {
              post,
              comment: { ...post, excerpt: 'Nice!' },
            })}
          />
        </li>
        <li>
          <ActivityText activity={makeActivity('POST_LIKED', { post })} />
        </li>
        <li>
          <ActivityText
            activity={makeActivity('USER_FOLLOWED', { targetUser: summaryOf(carol) })}
          />
        </li>
        <li>
          <ActivityText activity={makeActivity('PROFILE_UPDATED')} />
        </li>
        <li>
          <ActivityText activity={makeActivity('USER_REGISTERED')} />
        </li>
      </ul>,
    );
    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(items).toEqual([
      'Bob Brown published a post: “Hello world”',
      'Bob Brown commented: “Nice!”',
      'Bob Brown liked a post: “Hello world”',
      'Bob Brown started following Carol Clark',
      'Bob Brown updated their profile',
      'Bob Brown joined The Mesh',
    ]);
    expect(screen.getAllByRole('link', { name: 'Bob Brown' })).toHaveLength(6);
    expect(screen.getByRole('link', { name: 'Carol Clark' })).toHaveAttribute('href', '/u/carol');
  });
});
