import { createReportSchema } from '@beso/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateReportDto extends createZodDto(createReportSchema) {}
