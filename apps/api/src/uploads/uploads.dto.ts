import { uploadKindSchema, uploadQuerySchema } from '@the-mesh/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class UploadQueryDto extends createZodDto(uploadQuerySchema) {}

const uploadPathSchema = z.object({
  kind: uploadKindSchema,
  file: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/),
});
export class UploadPathDto extends createZodDto(uploadPathSchema) {}
