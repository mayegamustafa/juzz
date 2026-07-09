import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { StudentsService } from './students.service';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';
import { PaginationQuery } from '../common/dto';

class ListStudentsQuery extends PaginationQuery {
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() streamId?: string;
  @IsOptional() @IsString() teacherId?: string;
}
class CreateStudentDto {
  @IsOptional() @IsString() schoolId?: string;
  @IsString() classId!: string;
  @IsOptional() @IsString() streamId?: string;
  @IsString() admissionNo!: string;
  @IsString() fullName!: string;
  @IsOptional() @IsIn(['MALE', 'FEMALE']) gender?: 'MALE' | 'FEMALE';
  @IsOptional() @IsString() guardianName?: string;
  @IsOptional() @IsString() guardianPhone?: string;
  @IsOptional() @IsString() primaryTeacherId?: string;
}

@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: ListStudentsQuery) {
    return this.students.list(user, q);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.students.get(user, id);
  }

  @Get(':id/progress')
  progress(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.students.progress(user, id);
  }

  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStudentDto) {
    return this.students.create(user, dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateStudentDto>) {
    return this.students.update(id, dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.students.remove(id);
  }
}
