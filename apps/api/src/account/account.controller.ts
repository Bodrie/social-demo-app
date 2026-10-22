import { Body, Controller, Delete, Get, HttpCode, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AccountExport } from '@beso/shared';
import type { Response } from 'express';
import { ZodResponse } from 'nestjs-zod';
import { AllowUnverified } from '../auth/allow-unverified.decorator.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { clearAuthCookies } from '../auth/cookies.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { AccountExportDto } from '../common/responses.dto.js';
import { DeleteAccountDto } from './account.dto.js';
import { AccountService } from './account.service.js';

/** The account itself: a copy of everything it holds, and its deletion. Both work before verification. */
@ApiTags('account')
@Controller('users/me')
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly auth: AuthService,
  ) {}

  /** A JSON file download; the browser saves it under the name in the header. */
  @AllowUnverified()
  @Get('export')
  @ZodResponse({ status: 200, type: AccountExportDto })
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  async export(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AccountExport> {
    const data = await this.account.export(user.id);
    const date = data.exportedAt.slice(0, 10);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="beso-export-${data.user.username}-${date}.json"`,
    );
    return data;
  }

  /** Erases the account; the cookies go with it, the socket is cut by the service. */
  @AllowUnverified()
  @Delete()
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async remove(
    @CurrentUser() user: AuthUser,
    @Body() body: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.account.delete(user.id, body);
    clearAuthCookies(res, this.auth.cookieSettings);
  }
}
