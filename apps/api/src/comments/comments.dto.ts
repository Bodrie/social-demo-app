import { commentsQuerySchema, createCommentSchema } from '@the-mesh/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateCommentDto extends createZodDto(createCommentSchema) {}
export class CommentsQueryDto extends createZodDto(commentsQuerySchema) {}
