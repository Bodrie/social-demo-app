import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthResponse } from '@the-mesh/shared';
import type { Request, Response } from 'express';
import { ChangePasswordDto, LoginDto, RegisterDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { type AuthUser, requestMeta } from './auth.types.js';
import { REFRESH_COOKIE, clearAuthCookies, readCookie, setAuthCookies } from './cookies.js';
import { CredentialRoute } from './credential-throttle.js';
import { CurrentUser } from './current-user.decorator.js';
import { Public } from './public.decorator.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @CredentialRoute()
  @Post('register')
  @HttpCode(201)
  async register(
    @Body() body: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { user, tokens } = await this.auth.register(body, requestMeta(req));
    setAuthCookies(res, tokens, this.auth.cookieSettings);
    return { user };
  }

  @Public()
  @CredentialRoute()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { user, tokens } = await this.auth.login(body, requestMeta(req));
    setAuthCookies(res, tokens, this.auth.cookieSettings);
    return { user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    try {
      const { user, tokens } = await this.auth.refresh(
        readCookie(req.cookies, REFRESH_COOKIE),
        requestMeta(req),
      );
      setAuthCookies(res, tokens, this.auth.cookieSettings);
      return { user };
    } catch (error) {
      // Only a rejected token ends the session; a transient failure keeps the cookies for a retry.
      if (error instanceof UnauthorizedException) clearAuthCookies(res, this.auth.cookieSettings);
      throw error;
    }
  }

  /** Public so a client with an expired access token can still end its session. */
  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readCookie(req.cookies, REFRESH_COOKIE));
    clearAuthCookies(res, this.auth.cookieSettings);
  }

  @Post('logout-all')
  @HttpCode(204)
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logoutAll(user.id);
    clearAuthCookies(res, this.auth.cookieSettings);
  }

  /** The current session stays signed in; every other device is signed out. */
  @Post('password')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() body: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.auth.changePassword(user.id, body, readCookie(req.cookies, REFRESH_COOKIE));
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser): Promise<AuthResponse> {
    return { user: await this.auth.me(user.id) };
  }
}
