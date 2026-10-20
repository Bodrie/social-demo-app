import { Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminReport, Paginated } from '@the-mesh/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { IdParamDto, UserIdParamDto } from '../common/params.dto.js';
import { AdminReportsQueryDto } from './admin.dto.js';
import { AdminService } from './admin.service.js';
import { Roles } from './roles.decorator.js';

/** Admins only (ADR 0016): the reports queue and what an admin may do about it. */
@ApiTags('admin')
@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('reports')
  reports(@Query() query: AdminReportsQueryDto): Promise<Paginated<AdminReport>> {
    return this.admin.reports(query);
  }

  @Post('reports/:id/resolve')
  @HttpCode(200)
  resolve(@CurrentUser() user: AuthUser, @Param() params: IdParamDto): Promise<AdminReport> {
    return this.admin.resolve(user.id, params.id);
  }

  @Post('reports/:id/dismiss')
  @HttpCode(200)
  dismiss(@CurrentUser() user: AuthUser, @Param() params: IdParamDto): Promise<AdminReport> {
    return this.admin.dismiss(user.id, params.id);
  }

  @Delete('posts/:id')
  @HttpCode(204)
  deletePost(@CurrentUser() user: AuthUser, @Param() params: IdParamDto): Promise<void> {
    return this.admin.deletePost(user.id, params.id);
  }

  @Delete('comments/:id')
  @HttpCode(204)
  deleteComment(@CurrentUser() user: AuthUser, @Param() params: IdParamDto): Promise<void> {
    return this.admin.deleteComment(user.id, params.id);
  }

  @Post('users/:userId/suspend')
  @HttpCode(204)
  suspend(@CurrentUser() user: AuthUser, @Param() params: UserIdParamDto): Promise<void> {
    return this.admin.suspend(user.id, params.userId);
  }

  @Post('users/:userId/unsuspend')
  @HttpCode(204)
  unsuspend(@CurrentUser() user: AuthUser, @Param() params: UserIdParamDto): Promise<void> {
    return this.admin.unsuspend(user.id, params.userId);
  }
}
