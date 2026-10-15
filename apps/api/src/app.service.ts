import { Injectable } from '@nestjs/common';
import { healthResponseSchema, type HealthResponse } from '@the-mesh/shared';

@Injectable()
export class AppService {
  getHealth(): HealthResponse {
    return healthResponseSchema.parse({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }
}
