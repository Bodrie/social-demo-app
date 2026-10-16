import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import type { ChangePasswordData, LoginData, RegisterData, UserPrivate } from '@the-mesh/shared';
import { unauthorized, validationError } from '../common/errors.js';
import type { Env } from '../config/env.js';
import { EmailService } from '../email/email.service.js';
import { UserRegisteredEvent } from '../events/user.events.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import type { AccessTokenClaims, IssuedTokens, RequestMeta } from './auth.types.js';
import type { CookieSettings } from './cookies.js';
import { EmailTokensService } from './email-tokens.service.js';
import { dummyPasswordHash, hashPassword, verifyPassword } from './password.js';
import { RefreshTokensService } from './refresh-tokens.service.js';

export type AuthResult = { user: UserPrivate; tokens: IssuedTokens };

@Injectable()
export class AuthService {
  readonly cookieSettings: CookieSettings;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokensService,
    private readonly emailTokens: EmailTokensService,
    private readonly email: EmailService,
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

  /** The account starts unverified: the session works, but only for the verification routes. */
  async register(input: RegisterData, meta: RequestMeta): Promise<AuthResult> {
    await this.users.assertAvailable({ email: input.email, username: input.username });
    const passwordHash = await hashPassword(input.password);
    const created = await this.prisma.user.create({
      data: { email: input.email, username: input.username, name: input.name, passwordHash },
      select: { id: true, email: true, name: true },
    });
    await this.events.emitAsync(UserRegisteredEvent.EVENT, new UserRegisteredEvent(created.id));
    await this.email.sendVerification(
      created,
      await this.emailTokens.issue(created.id, 'verify_email'),
    );
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
        accessToken: await this.signAccessToken(user),
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

  /** Verifies the current password, stores the new hash and ends every other session. */
  async changePassword(
    userId: string,
    input: ChangePasswordData,
    rawRefreshToken: string | undefined,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw validationError({ currentPassword: 'Wrong password' });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });
    await this.emailTokens.voidAll(userId, 'password_reset');
    await this.refreshTokens.revokeOthers(userId, rawRefreshToken);
  }

  /** The mailed link: proves the address, opens the account and signs that browser in. */
  async verifyEmail(rawToken: string, meta: RequestMeta): Promise<AuthResult> {
    const userId = await this.emailTokens.consume(rawToken, 'verify_email');
    await this.prisma.user.updateMany({
      where: { id: userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
    return this.session(userId, meta);
  }

  /** A fresh link for a signed-in member who is still waiting; a no-op once verified. */
  async resendVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true, emailVerifiedAt: true },
    });
    if (user.emailVerifiedAt !== null) return;
    await this.email.sendVerification(user, await this.emailTokens.issue(user.id, 'verify_email'));
  }

  /**
   * Answered the same way for every address. The mail goes out without being awaited so the
   * response time does not say whether the address belongs to an account.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });
    if (!user) return;
    void this.emailTokens
      .issue(user.id, 'password_reset')
      .then((token) => this.email.sendPasswordReset(user, token))
      .catch((error: unknown) =>
        this.logger.warn({ err: error, userId: user.id }, 'Could not send the password reset mail'),
      );
  }

  /**
   * Sets the new password, counts the address as verified (the link proved it), ends every
   * existing session and opens a new one for the browser that completed the form.
   */
  async resetPassword(
    rawToken: string,
    newPassword: string,
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const userId = await this.emailTokens.consume(rawToken, 'password_reset');
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.user.updateMany({
        where: { id: userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);
    await this.refreshTokens.revokeAll(userId);
    return this.session(userId, meta);
  }

  /** The caller's profile for GET /auth/me; a token for a deleted account is treated as no session. */
  async me(userId: string): Promise<UserPrivate> {
    const user = await this.users.findPrivateById(userId);
    if (!user) throw unauthorized('This account no longer exists');
    return user;
  }

  private async session(userId: string, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.users.getPrivateById(userId);
    const [accessToken, refresh] = await Promise.all([
      this.signAccessToken(user),
      this.refreshTokens.issue(userId, meta),
    ]);
    return {
      user,
      tokens: { accessToken, refreshToken: refresh.raw, refreshExpiresAt: refresh.expiresAt },
    };
  }

  /** `ev` travels in the token so the guard can close the app to unverified accounts without a lookup. */
  private signAccessToken(user: Pick<UserPrivate, 'id' | 'emailVerifiedAt'>): Promise<string> {
    const claims: AccessTokenClaims = { sub: user.id, ev: user.emailVerifiedAt !== null };
    return this.jwt.signAsync(claims);
  }
}
