import { notificationsQuerySchema } from '@the-mesh/shared';
import { createZodDto } from 'nestjs-zod';

export class NotificationsQueryDto extends createZodDto(notificationsQuerySchema) {}
