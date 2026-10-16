import {
  commentsQuerySchema,
  createCommentSchema,
  setReactionSchema,
  updateCommentSchema,
} from '@the-mesh/shared';
import { createZodDto } from 'nestjs-zod';

export class CreateCommentDto extends createZodDto(createCommentSchema) {}
export class UpdateCommentDto extends createZodDto(updateCommentSchema) {}
export class SetReactionDto extends createZodDto(setReactionSchema) {}
export class CommentsQueryDto extends createZodDto(commentsQuerySchema) {}
