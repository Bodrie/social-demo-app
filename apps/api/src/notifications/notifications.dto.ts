import { notificationsQuerySchema } from '@beso/shared';
import { createZodDto } from 'nestjs-zod';

export class NotificationsQueryDto extends createZodDto(notificationsQuerySchema) {}
