import {
  changeEmailSchema,
  changePasswordSchema,
  confirmEmailChangeSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '@beso/shared';
import { createZodDto } from 'nestjs-zod';

export class RegisterDto extends createZodDto(registerSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
export class VerifyEmailDto extends createZodDto(verifyEmailSchema) {}
export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
export class ChangeEmailDto extends createZodDto(changeEmailSchema) {}
export class ConfirmEmailChangeDto extends createZodDto(confirmEmailChangeSchema) {}
