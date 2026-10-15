import { createPostSchema, feedQuerySchema } from '@the-mesh/shared';
import { createZodDto } from 'nestjs-zod';

export class CreatePostDto extends createZodDto(createPostSchema) {}
export class FeedQueryDto extends createZodDto(feedQuerySchema) {}
