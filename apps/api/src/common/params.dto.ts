import { cursorQuerySchema, uuidSchema } from '@the-mesh/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Route parameters validated like bodies: a malformed id is a VALIDATION_ERROR keyed by the parameter name. */
export class IdParamDto extends createZodDto(z.object({ id: uuidSchema })) {}
export class UserIdParamDto extends createZodDto(z.object({ userId: uuidSchema })) {}
export class PostIdParamDto extends createZodDto(z.object({ postId: uuidSchema })) {}
/** `?limit=&cursor=` for lists that need nothing else (revisions). */
export class CursorQueryDto extends createZodDto(cursorQuerySchema) {}
export class UsernameParamDto extends createZodDto(
  z.object({ username: z.string().trim().toLowerCase().min(1).max(30) }),
) {}
