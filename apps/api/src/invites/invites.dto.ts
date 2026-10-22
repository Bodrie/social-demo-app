import { inviteCodeSchema } from '@beso/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class InviteCodeParamDto extends createZodDto(z.object({ code: inviteCodeSchema })) {}
