import { pushEndpointSchema, pushSubscriptionSchema } from '@beso/shared';
import { createZodDto } from 'nestjs-zod';

export class PushSubscriptionDto extends createZodDto(pushSubscriptionSchema) {}
export class PushEndpointDto extends createZodDto(pushEndpointSchema) {}
