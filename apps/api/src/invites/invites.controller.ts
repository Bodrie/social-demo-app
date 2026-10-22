import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Invite, InviteLookup } from '@beso/shared';
import { ZodResponse } from 'nestjs-zod';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { InviteDto, InviteLookupDto } from '../common/responses.dto.js';
import { InviteCodeParamDto } from './invites.dto.js';
import { InvitesService } from './invites.service.js';

@ApiTags('invites')
@Controller('invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  /** The member's own link, made on the first ask. */
  @Get('me')
  @ZodResponse({ status: 200, type: InviteDto })
  mine(@CurrentUser() user: AuthUser): Promise<Invite> {
    return this.invites.mine(user.id);
  }

  @Post('me/renew')
  @ZodResponse({ status: 200, type: InviteDto })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  renew(@CurrentUser() user: AuthUser): Promise<Invite> {
    return this.invites.renew(user.id);
  }

  /** For the join page, before anyone has an account. */
  @Public()
  @Get(':code')
  @ZodResponse({ status: 200, type: InviteLookupDto })
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  lookup(@Param() params: InviteCodeParamDto): Promise<InviteLookup> {
    return this.invites.lookup(params.code);
  }
}
