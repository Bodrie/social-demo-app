import { Body, Controller, Delete, Get, HttpCode, Put, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { PushConfig } from '@beso/shared';
import type { Request } from 'express';
import { ZodResponse } from 'nestjs-zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { PushConfigDto } from '../common/responses.dto.js';
import { serviceUnavailable } from '../common/errors.js';
import { PushEndpointDto, PushSubscriptionDto } from './push.dto.js';
import { PushService } from './push.service.js';

/** This browser's push subscription (ADR 0022). */
@ApiTags('push')
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  /** The key a browser subscribes with; null while the server has push switched off. */
  @Get('config')
  @ZodResponse({ status: 200, type: PushConfigDto })
  config(): PushConfig {
    return this.push.config();
  }

  @Put('subscriptions')
  @HttpCode(204)
  async subscribe(
    @CurrentUser() user: AuthUser,
    @Body() body: PushSubscriptionDto,
    @Req() req: Request,
  ): Promise<void> {
    if (!this.push.enabled) throw serviceUnavailable('Push notifications are switched off');
    const userAgent = req.headers['user-agent'];
    await this.push.subscribe(user, body, typeof userAgent === 'string' ? userAgent : undefined);
  }

  @Delete('subscriptions')
  @HttpCode(204)
  unsubscribe(@CurrentUser() user: AuthUser, @Body() body: PushEndpointDto): Promise<void> {
    return this.push.unsubscribe(user.id, body.endpoint);
  }
}
