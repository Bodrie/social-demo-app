import { adminReportsQuerySchema } from '@beso/shared';
import { createZodDto } from 'nestjs-zod';

export class AdminReportsQueryDto extends createZodDto(adminReportsQuerySchema) {}
