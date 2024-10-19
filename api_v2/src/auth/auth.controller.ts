import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthService } from './auth.service';
import { UserService } from 'src/user/user.service';
import { error } from 'console';

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
    if (!email.length || !password.length || !name.length || !userName.length) {
      throw new BadRequestException({
        error: 'user/required-fields',
        message: 'Required fields!',
      });
    }
    try {
      const hashedPassword = await this.authService.hashPassword(password);

      const user = await this.userService.createUser({
        email,
        password: hashedPassword,
        name,
        userName,
      });

      return user;
    } catch (error) {
      throw new BadRequestException({
        error: error,
        message: 'User register error!',
      });
    }
  }

  @Post('login')
  async loginUser(@Body() { email, password }: Prisma.UserWhereUniqueInput) {
    const passwordToString = password.toString();

    if (!email.length || !passwordToString.length) {
      throw new BadRequestException({
        error: 'user/required-fields',
        message: 'Required fields!',
      });
    }
    try {
      const user = await this.userService.user({
        email,
      });

      if (!user) {
        throw new BadRequestException({
          error: 'user/missmatch',
          message: 'User not found or wrong credentials!',
        });
      }

      const passwordMatch = await this.authService.comparePasswords(
        passwordToString,
        user.password,
      );

      if (passwordMatch) {
        return user;
      } else {
        throw new BadRequestException({
          error: 'user/missmatch',
          message: 'User not found or wrong credentials!',
        });
      }
    } catch (error) {
      throw new BadRequestException({
        error: error,
        message: 'User login error!',
      });
    }
  }
}
