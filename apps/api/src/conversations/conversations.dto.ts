import {
  addMembersSchema,
  createGroupSchema,
  messagesQuerySchema,
  sendMessageSchema,
} from '@the-mesh/shared';
import { createZodDto } from 'nestjs-zod';

export class SendMessageDto extends createZodDto(sendMessageSchema) {}
export class MessagesQueryDto extends createZodDto(messagesQuerySchema) {}
export class CreateGroupDto extends createZodDto(createGroupSchema) {}
export class AddMembersDto extends createZodDto(addMembersSchema) {}
