import { Body, Controller, Get, Post } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async registerUser(
    @Body() { email, password, name, userName }: Prisma.UserCreateInput,
  ) {
    return await this.authService.register({ email, password, name, userName });
  }

  @Post('login')
  async loginUser(@Body() { email, password }: Prisma.UserWhereUniqueInput) {
    return await this.authService.login({ email, password });
  }
}
