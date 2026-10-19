import { deleteAccountSchema } from '@the-mesh/shared';
import { createZodDto } from 'nestjs-zod';

export class DeleteAccountDto extends createZodDto(deleteAccountSchema) {}
