import {
  type CreateReportInput,
  type MemberList,
  type Report,
  memberListSchema,
  reportSchema,
} from '@beso/shared';
import { api } from './client';
import { type PageOptions, queryString } from './query';

export const blockUser = (userId: string): Promise<void> => api.put(`/users/${userId}/block`);
export const unblockUser = (userId: string): Promise<void> => api.delete(`/users/${userId}/block`);
export const muteUser = (userId: string): Promise<void> => api.put(`/users/${userId}/mute`);
export const unmuteUser = (userId: string): Promise<void> => api.delete(`/users/${userId}/mute`);

export const fetchBlocked = ({ cursor, signal }: PageOptions): Promise<MemberList> =>
  api.get(`/users/me/blocked${queryString({ cursor })}`, memberListSchema, { signal });
export const fetchMuted = ({ cursor, signal }: PageOptions): Promise<MemberList> =>
  api.get(`/users/me/muted${queryString({ cursor })}`, memberListSchema, { signal });

export const createReport = (input: CreateReportInput): Promise<Report> =>
  api.post('/reports', input, { schema: reportSchema });
