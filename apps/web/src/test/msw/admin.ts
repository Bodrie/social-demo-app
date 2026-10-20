import { type AdminReport, type ReportStatus, adminReportsQuerySchema } from '@the-mesh/shared';
import { HttpResponse, http } from 'msw/http';
import { summaryOf } from '../fixtures';
import { API, apiError, unauthorized } from './auth';
import { mockDb, paginate } from './db';

const param = (value: string | readonly string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';
const noContent = () => new HttpResponse(null, { status: 204 });
const forbidden = () => apiError(403, 'FORBIDDEN', 'Admins only');

/** A member as the queue shows it, with their suspension state; null when unknown. */
function memberOf(userId: string) {
  const user = mockDb.users.find((candidate) => candidate.id === userId);
  return user ? { ...summaryOf(user), suspended: mockDb.suspended.includes(user.id) } : null;
}

/** Like the API: the report with its reporter and what it points at, or `gone`. */
function toAdminReport(report: (typeof mockDb.reports)[number]): AdminReport {
  const reporter = mockDb.users.find((user) => user.id === report.reporterId);
  const base = {
    type: report.targetType,
    id: report.targetId,
    gone: true,
    excerpt: null,
    postId: null,
    member: null,
  };
  let target: AdminReport['target'] = base;
  if (report.targetType === 'post') {
    const post = mockDb.posts.find((item) => item.id === report.targetId);
    if (post) {
      target = {
        ...base,
        gone: false,
        excerpt: post.content,
        postId: post.id,
        member: memberOf(post.author.id),
      };
    }
  } else if (report.targetType === 'comment') {
    const comment = mockDb.comments.find((item) => item.id === report.targetId);
    if (comment) {
      target = {
        ...base,
        gone: false,
        excerpt: comment.content,
        postId: comment.postId,
        member: memberOf(comment.author.id),
      };
    }
  } else {
    const user = memberOf(report.targetId);
    if (user) target = { ...base, gone: false, member: user };
  }
  if (!reporter) throw new Error("the report's reporter is not in mockDb.users");
  return {
    id: report.id,
    targetType: report.targetType,
    targetId: report.targetId,
    reason: report.reason,
    details: report.details,
    status: report.status,
    createdAt: report.createdAt,
    resolvedAt: report.status === 'open' ? null : new Date().toISOString(),
    reporter: summaryOf(reporter),
    target,
  };
}

export const adminHandlers = [
  http.get(`${API}/admin/reports`, ({ request }) => {
    if (!mockDb.user) return unauthorized();
    if (mockDb.user.role !== 'admin') return forbidden();
    const url = new URL(request.url);
    const query = adminReportsQuerySchema.parse({
      status: url.searchParams.get('status') ?? undefined,
    });
    const items = mockDb.reports
      .filter((report) => report.status === query.status)
      .map(toAdminReport);
    return HttpResponse.json(paginate(items, url));
  }),

  http.post(`${API}/admin/reports/:id/:outcome`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    if (mockDb.user.role !== 'admin') return forbidden();
    const report = mockDb.reports.find((item) => item.id === param(params.id));
    if (!report) return apiError(404, 'NOT_FOUND', 'Report not found');
    const status: ReportStatus = param(params.outcome) === 'resolve' ? 'resolved' : 'dismissed';
    report.status = status;
    return HttpResponse.json(toAdminReport(report));
  }),

  http.delete(`${API}/admin/posts/:id`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    if (mockDb.user.role !== 'admin') return forbidden();
    mockDb.posts = mockDb.posts.filter((post) => post.id !== param(params.id));
    return noContent();
  }),

  http.delete(`${API}/admin/comments/:id`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    if (mockDb.user.role !== 'admin') return forbidden();
    mockDb.comments = mockDb.comments.filter((comment) => comment.id !== param(params.id));
    return noContent();
  }),

  http.post(`${API}/admin/users/:userId/suspend`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    if (mockDb.user.role !== 'admin') return forbidden();
    const userId = param(params.userId);
    if (!mockDb.suspended.includes(userId)) mockDb.suspended.push(userId);
    return noContent();
  }),

  http.post(`${API}/admin/users/:userId/unsuspend`, ({ params }) => {
    if (!mockDb.user) return unauthorized();
    if (mockDb.user.role !== 'admin') return forbidden();
    mockDb.suspended = mockDb.suspended.filter((id) => id !== param(params.userId));
    return noContent();
  }),
];
