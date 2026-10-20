import { deleteAccountSchema } from '@beso/shared';
import { createZodDto } from 'nestjs-zod';

export class DeleteAccountDto extends createZodDto(deleteAccountSchema) {}
