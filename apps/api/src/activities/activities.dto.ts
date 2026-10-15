import { activitiesQuerySchema } from '@the-mesh/shared';
import { createZodDto } from 'nestjs-zod';

export class ActivitiesQueryDto extends createZodDto(activitiesQuerySchema) {}
