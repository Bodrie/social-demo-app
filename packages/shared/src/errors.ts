import { z } from 'zod';

/** Stable, machine-readable error codes returned by the API. */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'TOO_MANY_REQUESTS',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
  /** The bot check could not be reached; registration is refused rather than waved through. */
  'CAPTCHA_UNAVAILABLE',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/**
 * The one error envelope every API error uses.
 * `fields` maps an input path (e.g. "email", "address.city") to a message so
 * forms can attach errors to inputs. `requestId` matches the X-Request-Id header.
 */
export const apiErrorSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  code: errorCodeSchema,
  message: z.string(),
  fields: z.record(z.string(), z.string()).optional(),
  requestId: z.string().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export function isApiError(value: unknown): value is ApiError {
  return apiErrorSchema.safeParse(value).success;
}
