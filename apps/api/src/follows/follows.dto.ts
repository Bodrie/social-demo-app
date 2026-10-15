import { followsQuerySchema } from '@the-mesh/shared';
import { createZodDto } from 'nestjs-zod';

export class FollowsQueryDto extends createZodDto(followsQuerySchema) {}
