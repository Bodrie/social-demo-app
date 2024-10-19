import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/auth/auth.guard';
import { UserService } from './user.service';
import { prismaExcludeField } from 'src/common/utils/prismaExcludeField';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  @UseGuards(AuthGuard)
  async getUser(@Param('id') id: string) {
    return await this.userService.user(
      { id },
      { select: prismaExcludeField('User', ['password']) },
    );
  }
}
