import { hashtagSchema, trendingQuerySchema } from '@beso/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** `/tags/:tag/...`: a leading `#` is tolerated and the case is folded, like the parser does. */
export class TagParamDto extends createZodDto(z.object({ tag: hashtagSchema })) {}
export class TrendingQueryDto extends createZodDto(trendingQuerySchema) {}
