import {
  listUsersQuerySchema,
  suggestionsQuerySchema,
  updateProfileSchema,
  updateSettingsSchema,
} from '@the-mesh/shared';
import { createZodDto } from 'nestjs-zod';

export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
export class UpdateSettingsDto extends createZodDto(updateSettingsSchema) {}
export class ListUsersQueryDto extends createZodDto(listUsersQuerySchema) {}
export class SuggestionsQueryDto extends createZodDto(suggestionsQuerySchema) {}
