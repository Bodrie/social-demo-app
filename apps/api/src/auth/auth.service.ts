import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  ChangeEmailData,
  ChangePasswordData,
  ConfirmEmailChangeResponse,
  LoginData,
  RegisterData,
  Session,
  UserPrivate,
} from '@beso/shared';
import { CAPTCHA, CaptchaUnavailableError, type CaptchaVerifier } from '../captcha/captcha.js';
import {
  badRequest,
  conflict,
  notFound,
  serviceUnavailable,
  suspended,
  tooManyRequests,
  unauthorized,
  validationError,
} from '../common/errors.js';
import type { Env } from '../config/env.js';
import { EmailService } from '../email/email.service.js';
import { UserRegisteredEvent, UserVerifiedEvent } from '../events/user.events.js';
import { InvitesService } from '../invites/invites.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccessTokensService } from '../tokens/access-tokens.service.js';
import { UsersService } from '../users/users.service.js';
import type { IssuedTokens, RequestMeta } from './auth.types.js';
import type { CookieSettings } from './cookies.js';
import { EmailTokensService, INVALID_LINK } from './email-tokens.service.js';
import { dummyPasswordHash, hashPassword, verifyPassword } from './password.js';
import { RefreshTokensService } from './refresh-tokens.service.js';
import { describeUserAgent, maskIp } from './user-agent.js';

export type AuthResult = { user: UserPrivate; tokens: IssuedTokens };
/** A verified session continued in the browser that already held it (see verifyEmail). */
export type VerifiedSession = { user: UserPrivate; accessToken: string };

@Injectable()
export class AuthService {
  readonly cookieSettings: CookieSettings;
  private readonly logger = new Logger(AuthService.name);
  private readonly adminEmails: string[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly accessTokens: AccessTokensService,
    private readonly refreshTokens: RefreshTokensService,
    private readonly emailTokens: EmailTokensService,
    private readonly email: EmailService,
    private readonly events: EventEmitter2,
    @Inject(CAPTCHA) private readonly captcha: CaptchaVerifier,
    private readonly invites: InvitesService,
    config: ConfigService<Env, true>,
  ) {
    this.cookieSettings = {
      secure:
        config.get('COOKIE_SECURE', { infer: true }) ??
        config.get('NODE_ENV', { infer: true }) === 'production',
      accessMaxAgeMs: config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }) * 1000,
      refreshMaxAgeMs: config.get('REFRESH_TTL_SECONDS', { infer: true }) * 1000,
    };
    this.adminEmails = config.get('ADMIN_EMAILS', { infer: true });
  }

  /** The account starts unverified: the session works, but only for the verification routes. */
  async register(input: RegisterData, meta: RequestMeta): Promise<AuthResult> {
    await this.assertHuman(input.captchaToken, meta.ip);
    await this.users.assertAvailable({ email: input.email, username: input.username });
    const passwordHash = await hashPassword(input.password);
    const invitedById = await this.invites.inviterOf(input.inviteCode);
    if (input.avatarPreset) await this.users.assertPreset(null, 'avatar', input.avatarPreset);
    const created = await this.prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        name: input.name,
        passwordHash,
        invitedById,
        avatarPreset: input.avatarPreset ?? null,
      },
      select: { id: true, email: true, name: true },
    });
    await this.events.emitAsync(UserRegisteredEvent.EVENT, new UserRegisteredEvent(created.id));
    // A brand-new account has had no mail yet, so the per-account limit never refuses this one.
    const token = await this.emailTokens.issue(created.id, 'verify_email');
    if (token) {
      // The account exists either way: a mail that cannot be sent is a warning in the log and
      // "Send the email again" in the waiting room, not a 500 that a retry turns into 409.
      try {
        await this.email.sendVerification(created, token);
      } catch (error) {
        this.logger.warn(
          { err: error, userId: created.id },
          'Could not send the verification mail',
        );
      }
    }
    return this.session(created.id, meta);
  }

  async login(input: LoginData, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, email: true, passwordHash: true, role: true, suspendedAt: true },
    });
    // Always run a verification so response time does not reveal whether the email exists.
    const valid = await verifyPassword(
      user?.passwordHash ?? (await dummyPasswordHash()),
      input.password,
    );
    if (!user || !valid) throw unauthorized('Invalid email or password');
    if (user.suspendedAt) throw suspended();
    // An address on ADMIN_EMAILS that registered after the last start becomes an admin here.
    if (user.role === 'member' && this.adminEmails.includes(user.email.toLowerCase())) {
      await this.prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } });
      this.logger.log({ userId: user.id }, 'Promoted to admin at sign-in (ADMIN_EMAILS)');
    }
    return this.session(user.id, meta);
  }

  async refresh(rawRefreshToken: string | undefined, meta: RequestMeta): Promise<AuthResult> {
    if (!rawRefreshToken) throw unauthorized('No refresh token');
    const rotated = await this.refreshTokens.rotate(rawRefreshToken, meta);
    await this.assertNotSuspended(rotated.userId);
    const user = await this.users.findPrivateById(rotated.userId);
    if (!user) throw unauthorized('This account no longer exists');
    return {
      user,
      tokens: {
        accessToken: await this.signAccessToken(user, rotated.signInId),
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
    // Nothing mailed earlier may still act on the account: a reset link would change the
    // password again, a confirmation link would sign a browser in (review L1).
    await this.emailTokens.voidAll(userId, 'password_reset');
    await this.emailTokens.voidAll(userId, 'verify_email');
    await this.refreshTokens.revokeOthers(userId, rawRefreshToken);
    this.notifyPasswordChanged(userId);
  }

  /**
   * The mailed link proves the inbox and opens the account. It signs in only a browser that
   * already holds a session of that same account (normally the one that registered), which
   * gets a new access token that says "verified". Anyone else's browser following the link
   * gets null: whoever registered an address they do not own could otherwise plant a link that
   * signs the owner into the stranger's account (or sign a victim into their own).
   */
  async verifyEmail(
    rawToken: string,
    rawRefreshToken: string | undefined,
  ): Promise<VerifiedSession | null> {
    const userId = await this.emailTokens.consume(rawToken, 'verify_email');
    const confirmed = await this.prisma.user.updateMany({
      where: { id: userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
    // An address confirmed some other way (a password reset) leaves its old link spent but
    // with nothing to do; such a link must not become a way in (review L1).
    if (confirmed.count === 0) return null;
    await this.opened(userId);
    const signInId = rawRefreshToken
      ? await this.refreshTokens.liveSignIn(rawRefreshToken, userId)
      : null;
    if (!signInId) return null;
    const user = await this.users.getPrivateById(userId);
    return { user, accessToken: await this.signAccessToken(user, signInId) };
  }

  /** A fresh link for a signed-in member who is still waiting; a no-op once verified. */
  async resendVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, name: true, emailVerifiedAt: true },
    });
    if (user.emailVerifiedAt !== null) return;
    const token = await this.emailTokens.issue(user.id, 'verify_email');
    if (!token) throw tooManyRequests('Enough emails were sent for now. Try again later.');
    await this.email.sendVerification(user, token);
  }

  /**
   * Answered the same way for every address. The mail goes out without being awaited so the
   * response time does not say whether the address belongs to an account, and nothing is
   * sent once the account had its share of reset mails (EMAIL_TOKEN_POLICY).
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });
    if (!user) return;
    void this.emailTokens
      .issue(user.id, 'password_reset')
      .then((token) => {
        if (token) return this.email.sendPasswordReset(user, token);
        this.logger.log({ userId: user.id }, 'Password reset mail skipped (limit reached)');
        return undefined;
      })
      .catch((error: unknown) =>
        this.logger.warn({ err: error, userId: user.id }, 'Could not send the password reset mail'),
      );
  }

  /**
   * Sets the new password, counts the address as verified (the link proved it), voids the
   * other reset links, ends every existing session and opens a new one for the browser that
   * completed the form.
   */
  async resetPassword(
    rawToken: string,
    newPassword: string,
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const userId = await this.emailTokens.consume(rawToken, 'password_reset');
    const passwordHash = await hashPassword(newPassword);
    const [, confirmed] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.user.updateMany({
        where: { id: userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);
    if (confirmed.count === 1) await this.opened(userId);
    await this.emailTokens.voidAll(userId, 'password_reset');
    await this.emailTokens.voidAll(userId, 'verify_email');
    await this.refreshTokens.revokeAll(userId);
    this.notifyPasswordChanged(userId);
    return this.session(userId, meta);
  }

  /** The caller's profile for GET /auth/me; a token for a deleted account is treated as no session. */
  async me(userId: string): Promise<UserPrivate> {
    const user = await this.users.findPrivateById(userId);
    if (!user) throw unauthorized('This account no longer exists');
    await this.assertNotSuspended(userId);
    return user;
  }

  /** A suspension ends the session wherever it is checked: sign-in, refresh and `me` (ADR 0016). */
  private async assertNotSuspended(userId: string): Promise<void> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { suspendedAt: true },
    });
    if (row?.suspendedAt) throw suspended();
  }

  /**
   * The bot check comes first, before anything is looked up or created. A check that cannot
   * be made refuses the registration: an outage must not open the door (ADR 0012).
   */
  private async assertHuman(token: string | undefined, ip: string | undefined): Promise<void> {
    let human: boolean;
    try {
      human = await this.captcha.verify(token, ip);
    } catch (error) {
      if (!(error instanceof CaptchaUnavailableError)) throw error;
      this.logger.warn({ err: error }, 'Bot check unavailable; registration refused');
      throw serviceUnavailable(
        'The bot check is not available right now. Please try again in a moment.',
        'CAPTCHA_UNAVAILABLE',
      );
    }
    if (!human) throw validationError({ captchaToken: 'Please complete the bot check' });
  }

  /**
   * Settings → Email (ADR 0010 amendment): the password proves the owner asked, the new
   * address must be free, the link goes to the new address and a notice to the old one.
   * Nothing changes until the link is opened. Open to unverified sessions: a mistyped
   * address is exactly their case.
   */
  async requestEmailChange(userId: string, input: ChangeEmailData): Promise<UserPrivate> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, name: true, passwordHash: true },
    });
    if (!(await verifyPassword(user.passwordHash, input.password))) {
      throw validationError({ password: 'Wrong password' });
    }
    if (input.newEmail === user.email) {
      throw validationError({ newEmail: 'That is already your address' });
    }
    await this.assertNewEmailFree(input.newEmail, userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { pendingEmail: input.newEmail },
    });
    await this.mailEmailChange(userId, user, input.newEmail, { notice: true });
    this.logger.log({ userId }, 'Email change requested');
    return this.users.getPrivateById(userId);
  }

  async resendEmailChange(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, name: true, pendingEmail: true },
    });
    if (!user.pendingEmail) throw badRequest('No change of address is pending');
    await this.mailEmailChange(userId, user, user.pendingEmail, { notice: false });
  }

  async cancelEmailChange(userId: string): Promise<UserPrivate> {
    await this.prisma.user.update({ where: { id: userId }, data: { pendingEmail: null } });
    await this.emailTokens.voidAll(userId, 'change_email');
    return this.users.getPrivateById(userId);
  }

  /**
   * The link from the new address: the swap, after checking the address is still free (it
   * may have been taken since the request; the request is then dropped). The new address is
   * confirmed by the link itself, so the account opens if it was still waiting.
   */
  async confirmEmailChange(rawToken: string): Promise<ConfirmEmailChangeResponse> {
    const userId = await this.emailTokens.consume(rawToken, 'change_email');
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, name: true, pendingEmail: true, emailVerifiedAt: true },
    });
    if (!user.pendingEmail) throw badRequest(INVALID_LINK, { token: INVALID_LINK });
    const newEmail = user.pendingEmail;
    try {
      await this.assertNewEmailFree(newEmail, userId);
    } catch (error) {
      await this.prisma.user.update({ where: { id: userId }, data: { pendingEmail: null } });
      throw error;
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { email: newEmail, pendingEmail: null, emailVerifiedAt: new Date() },
    });
    await this.emailTokens.voidAll(userId, 'change_email');
    if (user.emailVerifiedAt === null) await this.opened(userId);
    void this.email
      .sendEmailChanged({ email: user.email, name: user.name }, newEmail)
      .catch((error: unknown) =>
        this.logger.warn({ err: error, userId }, 'Could not send the email-changed notice'),
      );
    this.logger.log({ userId }, 'Email address changed');
    return { email: newEmail };
  }

  /** `UsersService.assertAvailable`, keyed to the form's field. */
  private async assertNewEmailFree(newEmail: string, userId: string): Promise<void> {
    const clash = await this.prisma.user.findFirst({
      where: { email: newEmail, NOT: { id: userId } },
      select: { id: true },
    });
    if (!clash) return;
    const message = 'An account with this email already exists';
    throw conflict(message, { newEmail: message });
  }

  private async mailEmailChange(
    userId: string,
    user: { email: string; name: string },
    newEmail: string,
    options: { notice: boolean },
  ): Promise<void> {
    const token = await this.emailTokens.issue(userId, 'change_email');
    if (!token) throw tooManyRequests('Enough emails were sent for now. Try again later.');
    await this.email.sendEmailChangeConfirm({ email: newEmail, name: user.name }, token);
    if (!options.notice) return;
    void this.email
      .sendEmailChangeNotice({ email: user.email, name: user.name }, newEmail)
      .catch((error: unknown) =>
        this.logger.warn({ err: error, userId }, 'Could not send the email-change notice'),
      );
  }

  /** The member's live sessions, the caller's own marked (ADR 0010 amendment). */
  async sessions(userId: string, currentRaw: string | undefined): Promise<Session[]> {
    const rows = await this.refreshTokens.listFor(userId, currentRaw);
    return rows.map((row) => {
      const agent = describeUserAgent(row.userAgent);
      return {
        id: row.id,
        browser: agent.browser,
        os: agent.os,
        ip: maskIp(row.ip),
        createdAt: row.createdAt.toISOString(),
        lastUsedAt: row.lastUsedAt.toISOString(),
        current: row.current,
      };
    });
  }

  /** Ends one session; the device's access token runs out within fifteen minutes. */
  async endSession(userId: string, sessionId: string): Promise<void> {
    if (!(await this.refreshTokens.revokeOne(userId, sessionId))) {
      throw notFound('Session not found');
    }
  }

  private async session(userId: string, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.users.getPrivateById(userId);
    const refresh = await this.refreshTokens.issue(userId, meta);
    const accessToken = await this.signAccessToken(user, refresh.signInId);
    return {
      user,
      tokens: { accessToken, refreshToken: refresh.raw, refreshExpiresAt: refresh.expiresAt },
    };
  }

  /** The first confirmed address opens the account: an invite's follow happens now (F1). */
  private async opened(userId: string): Promise<void> {
    await this.events.emitAsync(UserVerifiedEvent.EVENT, new UserVerifiedEvent(userId));
  }

  /** Not awaited: the change is done whether or not the notice can be delivered. */
  private notifyPasswordChanged(userId: string): void {
    void this.prisma.user
      .findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true } })
      .then((user) => this.email.sendPasswordChanged(user))
      .catch((error: unknown) =>
        this.logger.warn({ err: error, userId }, 'Could not send the password change notice'),
      );
  }

  /** `ev` and `role` travel in the token so the guards need no lookup; `sid` names the sign-in. */
  private signAccessToken(
    user: Pick<UserPrivate, 'id' | 'emailVerifiedAt' | 'role'>,
    signInId: string,
  ): Promise<string> {
    return this.accessTokens.sign({
      sub: user.id,
      ev: user.emailVerifiedAt !== null,
      role: user.role,
      sid: signInId,
    });
  }
}
