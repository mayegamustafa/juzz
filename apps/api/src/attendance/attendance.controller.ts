import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { IsDateString, IsIn, IsString } from 'class-validator';
import { AttendanceStatus, Role } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';

class UpsertAttendanceDto {
  @IsString() studentId!: string;
  @IsDateString() date!: string;
  @IsIn(['PRESENT', 'ABSENT', 'SICK', 'PERMISSION']) status!: AttendanceStatus;
}

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get()
  classDay(@CurrentUser() user: AuthUser, @Query('classId') classId: string, @Query('date') date: string) {
    return this.attendance.classDay(user, classId, date);
  }

  @Get('student/:id')
  forStudent(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.attendance.listForStudent(user, id);
  }

  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.TEACHER)
  @Put()
  upsert(@CurrentUser() user: AuthUser, @Body() dto: UpsertAttendanceDto) {
    return this.attendance.upsert(user, dto);
  }
}
