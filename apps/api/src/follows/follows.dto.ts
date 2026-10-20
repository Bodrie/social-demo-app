import { followsQuerySchema } from '@beso/shared';
import { createZodDto } from 'nestjs-zod';

export class FollowsQueryDto extends createZodDto(followsQuerySchema) {}
