import {
  createPostSchema,
  exploreQuerySchema,
  feedQuerySchema,
  updatePostSchema,
  userPostsQuerySchema,
} from '@beso/shared';
import { createZodDto } from 'nestjs-zod';

export class CreatePostDto extends createZodDto(createPostSchema) {}
export class UpdatePostDto extends createZodDto(updatePostSchema) {}
export class FeedQueryDto extends createZodDto(feedQuerySchema) {}
export class ExploreQueryDto extends createZodDto(exploreQuerySchema) {}
export class UserPostsQueryDto extends createZodDto(userPostsQuerySchema) {}
