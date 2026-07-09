import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { Gender, StudentStatus } from '@prisma/client';
import { StudentsService } from './students.service';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';
import { PaginationQuery } from '../common/dto';
import { ADMIN_ROLES, RECORDING_ROLES } from '../common/scope';

class ListStudentsQuery extends PaginationQuery {
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() streamId?: string;
  @IsOptional() @IsString() teacherId?: string;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED']) status?: StudentStatus;
}
class CreateStudentDto {
  @IsOptional() @IsString() schoolId?: string;
  @IsString() classId!: string;
  @IsOptional() @IsString() streamId?: string;
  @IsString() admissionNo!: string;
  @IsString() fullName!: string;
  @IsOptional() @IsIn(['MALE', 'FEMALE']) gender?: Gender;
  @IsOptional() @IsString() guardianName?: string;
  @IsOptional() @IsString() guardianPhone?: string;
  @IsOptional() @IsString() primaryTeacherId?: string;
}
class UpdateStudentDto {
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() streamId?: string;
  @IsOptional() @IsString() admissionNo?: string;
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsIn(['MALE', 'FEMALE']) gender?: Gender;
  @IsOptional() @IsString() guardianName?: string;
  @IsOptional() @IsString() guardianPhone?: string;
  @IsOptional() @IsString() primaryTeacherId?: string;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED']) status?: StudentStatus;
}
class StatusDto {
  @IsIn(['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED']) status!: StudentStatus;
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

  @Roles(...ADMIN_ROLES)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStudentDto) {
    return this.students.create(user, dto);
  }

  /**
   * Sheikhs may correct their own pupils' details (name, guardian, contact).
   * The service refuses reassignment (class / sheikh) for anyone but the secretariat.
   */
  @Roles(...RECORDING_ROLES)
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.students.update(user, id, dto);
  }

  @Roles(...ADMIN_ROLES)
  @Post(':id/status')
  setStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: StatusDto) {
    return this.students.setStatus(user, id, dto.status);
  }

  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.students.remove(user, id);
  }
}
