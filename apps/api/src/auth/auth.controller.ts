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
import type { AuthResponse, VerifyEmailResponse } from '@the-mesh/shared';
import type { Request, Response } from 'express';
import { AllowUnverified } from './allow-unverified.decorator.js';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { type AuthUser, requestMeta } from './auth.types.js';
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  readCookie,
  setAccessCookie,
  setAuthCookies,
} from './cookies.js';
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

  @AllowUnverified()
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

  /**
   * The link from the verification mail; works signed in or not. Only a browser that already
   * holds a session of that account stays signed in (now verified); any other gets `user: null`.
   */
  @Public()
  @Post('verify-email')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyEmail(
    @Body() body: VerifyEmailDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<VerifyEmailResponse> {
    const session = await this.auth.verifyEmail(
      body.token,
      readCookie(req.cookies, REFRESH_COOKIE),
    );
    if (!session) return { user: null };
    setAccessCookie(res, session.accessToken, this.auth.cookieSettings);
    return { user: session.user };
  }

  @AllowUnverified()
  @Post('verify-email/resend')
  @HttpCode(204)
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  resendVerification(@CurrentUser() user: AuthUser): Promise<void> {
    return this.auth.resendVerification(user.id);
  }

  /** Always 204: the answer must not say whether the address has an account. */
  @Public()
  @CredentialRoute()
  @Post('forgot-password')
  @HttpCode(204)
  forgotPassword(@Body() body: ForgotPasswordDto): Promise<void> {
    return this.auth.forgotPassword(body.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async resetPassword(
    @Body() body: ResetPasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { user, tokens } = await this.auth.resetPassword(
      body.token,
      body.newPassword,
      requestMeta(req),
    );
    setAuthCookies(res, tokens, this.auth.cookieSettings);
    return { user };
  }

  @AllowUnverified()
  @Get('me')
  async me(@CurrentUser() user: AuthUser): Promise<AuthResponse> {
    return { user: await this.auth.me(user.id) };
  }
}
