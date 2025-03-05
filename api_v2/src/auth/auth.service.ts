import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}
  private saltRounds = this.configService.get<number>('SALT');

  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(Number(this.saltRounds));
    return bcrypt.hash(password, salt);
  }

  async comparePasswords(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async register({ email, password, name, userName }: Prisma.UserCreateInput) {
    if (!email.length || !password.length || !name.length || !userName.length) {
      throw new BadRequestException({
        error: 'user/required-fields',
        message: 'Required fields!',
      });
    }
    console.log(
      'email, password, name, userName',
      email,
      password,
      name,
      userName,
    );
    try {
      const hashedPassword = await this.hashPassword(password);
      const user = await this.userService.createUser({
        email,
        password: hashedPassword,
        name,
        userName,
      });

      if (user.id) {
        return 'Successful registration!';
      }
    } catch (error) {
      throw new BadRequestException({
        error: error,
        message: 'User register error!',
      });
    }
  }

  async login({ email, password }: Prisma.UserWhereUniqueInput) {
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

      const passwordMatch = await this.comparePasswords(
        passwordToString,
        user.password,
      );

      if (passwordMatch) {
        const payload = { sub: user.id, username: user.userName };
        return {
          access_token: await this.jwtService.signAsync(payload),
        };
      } else {
        throw new BadRequestException({
          error: 'user/missmatch',
          message: 'User not found or wrong credentials!',
        });
      }
    } catch (error) {
      console.log('error', error);
      throw new BadRequestException({
        error: error,
        message: 'User login error!',
      });
    }
  }
}
