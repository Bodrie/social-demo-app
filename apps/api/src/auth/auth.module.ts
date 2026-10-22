import { Module } from '@nestjs/common';
import { CaptchaModule } from '../captcha/captcha.module.js';
import { EmailModule } from '../email/email.module.js';
import { InvitesModule } from '../invites/invites.module.js';
import { TokensModule } from '../tokens/tokens.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailTokensService } from './email-tokens.service.js';
import { RefreshTokensService } from './refresh-tokens.service.js';

@Module({
  imports: [UsersModule, EmailModule, CaptchaModule, TokensModule, InvitesModule],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokensService, EmailTokensService],
  exports: [AuthService, EmailTokensService, RefreshTokensService],
})
export class AuthModule {}
