import { activitiesQuerySchema } from '@beso/shared';
import { createZodDto } from 'nestjs-zod';

export class ActivitiesQueryDto extends createZodDto(activitiesQuerySchema) {}
