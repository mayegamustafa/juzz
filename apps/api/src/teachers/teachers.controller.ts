import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
import { TeachersService } from './teachers.service';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';

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

  @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR, Role.SCHOOL_ADMIN)
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('schoolId') schoolId?: string) {
    return this.teachers.list(user, schoolId);
  }

  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTeacherDto) {
    return this.teachers.create(user, dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTeacherDto) {
    return this.teachers.update(id, dto);
  }

  @Get(':id/students')
  students(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.teachers.studentsOf(user, id);
  }

  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN)
  @Post(':id/assignments')
  assign(@Param('id') id: string, @Body() dto: AssignDto) {
    return this.teachers.assign(id, dto);
  }
}
