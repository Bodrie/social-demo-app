import { searchQuerySchema } from '@beso/shared';
import { createZodDto } from 'nestjs-zod';

export class SearchQueryDto extends createZodDto(searchQuerySchema) {}
