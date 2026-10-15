import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import type { LoginData, RegisterData, UserPrivate } from '@the-mesh/shared';
import { unauthorized } from '../common/errors.js';
import type { Env } from '../config/env.js';
import { UserRegisteredEvent } from '../events/user.events.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import type { AccessTokenClaims, IssuedTokens, RequestMeta } from './auth.types.js';
import type { CookieSettings } from './cookies.js';
import { dummyPasswordHash, hashPassword, verifyPassword } from './password.js';
import { RefreshTokensService } from './refresh-tokens.service.js';

export type AuthResult = { user: UserPrivate; tokens: IssuedTokens };

@Injectable()
export class AuthService {
  readonly cookieSettings: CookieSettings;

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokensService,
    private readonly events: EventEmitter2,
    config: ConfigService<Env, true>,
  ) {
    this.cookieSettings = {
      secure:
        config.get('COOKIE_SECURE', { infer: true }) ??
        config.get('NODE_ENV', { infer: true }) === 'production',
      accessMaxAgeMs: config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }) * 1000,
      refreshMaxAgeMs: config.get('REFRESH_TTL_SECONDS', { infer: true }) * 1000,
    };
  }

  async register(input: RegisterData, meta: RequestMeta): Promise<AuthResult> {
    await this.users.assertAvailable({ email: input.email, username: input.username });
    const passwordHash = await hashPassword(input.password);
    const created = await this.prisma.user.create({
      data: { email: input.email, username: input.username, name: input.name, passwordHash },
      select: { id: true },
    });
    await this.events.emitAsync(UserRegisteredEvent.EVENT, new UserRegisteredEvent(created.id));
    return this.session(created.id, meta);
  }

  async login(input: LoginData, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, passwordHash: true },
    });
    // Always run a verification so response time does not reveal whether the email exists.
    const valid = await verifyPassword(
      user?.passwordHash ?? (await dummyPasswordHash()),
      input.password,
    );
    if (!user || !valid) throw unauthorized('Invalid email or password');
    return this.session(user.id, meta);
  }

  async refresh(rawRefreshToken: string | undefined, meta: RequestMeta): Promise<AuthResult> {
    if (!rawRefreshToken) throw unauthorized('No refresh token');
    const rotated = await this.refreshTokens.rotate(rawRefreshToken, meta);
    const user = await this.users.findPrivateById(rotated.userId);
    if (!user) throw unauthorized('This account no longer exists');
    return {
      user,
      tokens: {
        accessToken: await this.signAccessToken(rotated.userId),
        refreshToken: rotated.raw,
        refreshExpiresAt: rotated.expiresAt,
      },
    };
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (rawRefreshToken) await this.refreshTokens.revoke(rawRefreshToken);
  }

  logoutAll(userId: string): Promise<void> {
    return this.refreshTokens.revokeAll(userId);
  }

  /** The caller's profile for GET /auth/me; a token for a deleted account is treated as no session. */
  async me(userId: string): Promise<UserPrivate> {
    const user = await this.users.findPrivateById(userId);
    if (!user) throw unauthorized('This account no longer exists');
    return user;
  }

  private async session(userId: string, meta: RequestMeta): Promise<AuthResult> {
    const [user, accessToken, refresh] = await Promise.all([
      this.users.getPrivateById(userId),
      this.signAccessToken(userId),
      this.refreshTokens.issue(userId, meta),
    ]);
    return {
      user,
      tokens: { accessToken, refreshToken: refresh.raw, refreshExpiresAt: refresh.expiresAt },
    };
  }

  private signAccessToken(userId: string): Promise<string> {
    const claims: AccessTokenClaims = { sub: userId };
    return this.jwt.signAsync(claims);
  }
}
