import { messagesQuerySchema, sendMessageSchema } from '@the-mesh/shared';
import { createZodDto } from 'nestjs-zod';

export class SendMessageDto extends createZodDto(sendMessageSchema) {}
export class MessagesQueryDto extends createZodDto(messagesQuerySchema) {}
