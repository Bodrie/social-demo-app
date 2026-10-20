import {
  type AdminReport,
  type AdminReportList,
  type ReportStatus,
  adminReportListSchema,
  adminReportSchema,
} from '@beso/shared';
import { api } from './client';
import { type PageOptions, queryString } from './query';

export const fetchAdminReports = (
  status: ReportStatus,
  { cursor, signal }: PageOptions,
): Promise<AdminReportList> =>
  api.get(`/admin/reports${queryString({ status, cursor })}`, adminReportListSchema, { signal });

export const resolveReport = (id: string): Promise<AdminReport> =>
  api.post(`/admin/reports/${id}/resolve`, undefined, { schema: adminReportSchema });

export const dismissReport = (id: string): Promise<AdminReport> =>
  api.post(`/admin/reports/${id}/dismiss`, undefined, { schema: adminReportSchema });

export const adminDeletePost = (id: string): Promise<void> => api.delete(`/admin/posts/${id}`);

export const adminDeleteComment = (id: string): Promise<void> =>
  api.delete(`/admin/comments/${id}`);

export const suspendMember = (id: string): Promise<void> =>
  api.post(`/admin/users/${id}/suspend`, undefined);

export const unsuspendMember = (id: string): Promise<void> =>
  api.post(`/admin/users/${id}/unsuspend`, undefined);
