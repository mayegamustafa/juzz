import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';
import { ADMIN_ROLES } from '../common/scope';

class CreateUserDto {
  @IsString() @MinLength(2) fullName!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsIn(['SUPER_ADMIN', 'SUPERVISOR']) role!: Role;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() schoolId?: string;
}

class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) fullName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsIn(['SUPER_ADMIN', 'SUPERVISOR']) role?: Role;
  @IsOptional() @IsString() schoolId?: string;
}

class SetActiveDto {
  @IsBoolean() isActive!: boolean;
}

class ResetPasswordDto {
  @IsString() @MinLength(8) password!: string;
}

@Roles(...ADMIN_ROLES)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('role') role?: Role,
    @Query('includeTeachers') includeTeachers?: string,
  ) {
    return this.users.list(user, { role, includeTeachers: includeTeachers === 'true' });
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(user, id, dto);
  }

  @Post(':id/status')
  setActive(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.users.setActive(user, id, dto.isActive);
  }

  @Post(':id/reset-password')
  resetPassword(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.users.resetPassword(user, id, dto.password);
  }
}
