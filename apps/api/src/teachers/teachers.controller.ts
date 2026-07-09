import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { TeachersService } from './teachers.service';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';
import { ADMIN_ROLES } from '../common/scope';

class CreateTeacherDto {
  @IsString() fullName!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
}
class UpdateTeacherDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() schoolId?: string;
}
class ResetPasswordDto {
  @IsString() @MinLength(8) password!: string;
}
class AssignDto {
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() streamId?: string;
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() termId?: string;
}

@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachers: TeachersService) {}

  @Roles(...ADMIN_ROLES)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('schoolId') schoolId?: string) {
    return this.teachers.list(user, schoolId);
  }

  @Roles(...ADMIN_ROLES)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTeacherDto) {
    return this.teachers.create(user, dto);
  }

  @Roles(...ADMIN_ROLES)
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTeacherDto) {
    return this.teachers.update(user, id, dto);
  }

  @Roles(...ADMIN_ROLES)
  @Post(':id/reset-password')
  resetPassword(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.teachers.resetPassword(user, id, dto.password);
  }

  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.teachers.remove(user, id);
  }

  @Get(':id/students')
  students(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.teachers.studentsOf(user, id);
  }

  @Roles(...ADMIN_ROLES)
  @Post(':id/assignments')
  assign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AssignDto) {
    return this.teachers.assign(user, id, dto);
  }
}
