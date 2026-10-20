import { createReportSchema } from '@the-mesh/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateReportDto extends createZodDto(createReportSchema) {}
