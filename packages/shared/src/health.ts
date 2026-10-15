import { z } from 'zod';

/** Shape produced by @nestjs/terminus for GET /health. */
const healthIndicatorSchema = z
  .object({ status: z.enum(['up', 'down', 'degraded']) })
  .catchall(z.unknown());

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error', 'degraded', 'shutting_down']),
  info: z.record(z.string(), healthIndicatorSchema).optional(),
  error: z.record(z.string(), healthIndicatorSchema).optional(),
  details: z.record(z.string(), healthIndicatorSchema),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
