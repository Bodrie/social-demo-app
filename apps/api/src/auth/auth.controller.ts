import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthResponse } from '@the-mesh/shared';
import type { Request, Response } from 'express';
import { AuthResponseDto, LoginDto, RegisterDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { type AuthUser, requestMeta } from './auth.types.js';
import { REFRESH_COOKIE, clearAuthCookies, readCookie, setAuthCookies } from './cookies.js';
import { CurrentUser } from './current-user.decorator.js';
import { Public } from './public.decorator.js';
import { isRecord } from '../common/guards.js';
import { UsersService } from '../users/users.service.js';

/**
 * Credential endpoints are limited per client address *and* account: brute
 * forcing one account from one address is capped, while different accounts
 * behind one NAT (or a test suite) are not punished for each other.
 */
const CREDENTIAL_THROTTLE = {
  default: {
    limit: 10,
    ttl: 60_000,
    getTracker: (req: Record<string, unknown>): string => {
      const body = isRecord(req.body) ? req.body : {};
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const ip = typeof req.ip === 'string' ? req.ip : '';
      return `${ip}:${email}`;
    },
  },
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Throttle(CREDENTIAL_THROTTLE)
  @Post('register')
  @HttpCode(201)
  async register(
    @Body() body: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { user, tokens } = await this.auth.register(body, requestMeta(req));
    setAuthCookies(res, tokens, this.auth.cookieSettings);
    return { user };
  }

  @Public()
  @Throttle(CREDENTIAL_THROTTLE)
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
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    try {
      const { user, tokens } = await this.auth.refresh(readCookie(req.cookies, REFRESH_COOKIE), requestMeta(req));
      setAuthCookies(res, tokens, this.auth.cookieSettings);
      return { user };
    } catch (error) {
      clearAuthCookies(res, this.auth.cookieSettings);
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
  async logoutAll(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logoutAll(user.id);
    clearAuthCookies(res, this.auth.cookieSettings);
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser): Promise<AuthResponse> {
    return { user: await this.users.getPrivateById(user.id) };
  }
}
