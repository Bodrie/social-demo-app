import { adminReportsQuerySchema } from '@the-mesh/shared';
import { createZodDto } from 'nestjs-zod';

export class AdminReportsQueryDto extends createZodDto(adminReportsQuerySchema) {}
