import { createPostSchema, feedQuerySchema, updatePostSchema } from '@the-mesh/shared';
import { createZodDto } from 'nestjs-zod';

export class CreatePostDto extends createZodDto(createPostSchema) {}
export class UpdatePostDto extends createZodDto(updatePostSchema) {}
export class FeedQueryDto extends createZodDto(feedQuerySchema) {}
