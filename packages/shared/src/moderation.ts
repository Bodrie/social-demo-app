import { z } from 'zod';
import { uuidSchema } from './common.js';
import { paginatedSchema } from './pagination.js';
import { userSummarySchema } from './users.js';

/** Mirrors the database enums (ADR 0016). */
export const REPORT_TARGET_TYPES = ['post', 'comment', 'user'] as const;
export const reportTargetTypeSchema = z.enum(REPORT_TARGET_TYPES);
export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>;

export const REPORT_REASONS = [
  'spam',
  'harassment',
  'hate',
  'sexual',
  'violence',
  'other',
] as const;
export const reportReasonSchema = z.enum(REPORT_REASONS);
export type ReportReason = z.infer<typeof reportReasonSchema>;

/** What the report form shows for each reason. */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam or scam',
  harassment: 'Harassment or bullying',
  hate: 'Hate speech',
  sexual: 'Sexual content',
  violence: 'Violence or threats',
  other: 'Something else',
};

export const REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const;
export const reportStatusSchema = z.enum(REPORT_STATUSES);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const REPORT_DETAILS_MAX_LENGTH = 1000;

export const createReportSchema = z.object({
  targetType: reportTargetTypeSchema,
  targetId: uuidSchema,
  reason: reportReasonSchema,
  details: z
    .string()
    .trim()
    .max(REPORT_DETAILS_MAX_LENGTH, `At most ${REPORT_DETAILS_MAX_LENGTH} characters`)
    .optional(),
});
export type CreateReportInput = z.input<typeof createReportSchema>;
export type CreateReportData = z.output<typeof createReportSchema>;

/** What the reporter gets back; the admin queue (B5b) adds the target and the reporter. */
export const reportSchema = z.object({
  id: z.uuid(),
  targetType: reportTargetTypeSchema,
  targetId: z.uuid(),
  reason: reportReasonSchema,
  details: z.string().nullable(),
  status: reportStatusSchema,
  createdAt: z.iso.datetime(),
});
export type Report = z.infer<typeof reportSchema>;

/** `GET /users/me/blocked` and `/users/me/muted`: the people, newest first. */
export const memberListSchema = paginatedSchema(userSummarySchema);
export type MemberList = z.infer<typeof memberListSchema>;
