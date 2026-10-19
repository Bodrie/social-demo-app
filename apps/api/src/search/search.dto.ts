import { searchQuerySchema } from '@the-mesh/shared';
import { createZodDto } from 'nestjs-zod';

export class SearchQueryDto extends createZodDto(searchQuerySchema) {}
