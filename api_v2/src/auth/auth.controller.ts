import { Body, Controller, Post } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthService } from './auth.service';
import { UserService } from 'src/user/user.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Post('register')
  async createUser(
    @Body() { email, password, name, userName }: Prisma.UserCreateInput,
  ) {
    const hashedPassword = await this.authService.hashPassword(password);
    const user = await this.userService.createUser({
      email,
      password: hashedPassword,
      name,
      userName,
    });
    return user;
  }
}
