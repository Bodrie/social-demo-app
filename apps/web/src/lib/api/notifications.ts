import {
  type NotificationList,
  type UnreadCount,
  notificationListSchema,
  unreadCountSchema,
} from '@beso/shared';
import { api } from './client';
import { type PageOptions, queryString } from './query';

export const fetchNotifications = ({ cursor, signal }: PageOptions): Promise<NotificationList> =>
  api.get(`/notifications${queryString({ cursor })}`, notificationListSchema, { signal });

export const fetchUnreadNotifications = (signal?: AbortSignal): Promise<UnreadCount> =>
  api.get('/notifications/unread-count', unreadCountSchema, { signal });

export const markAllNotificationsRead = async (): Promise<void> => {
  await api.post('/notifications/read', undefined);
};
