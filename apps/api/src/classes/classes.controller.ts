import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { ClassesService } from './classes.service';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';

class CreateClassDto {
  @IsString() level!: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() order?: number;
}
class UpdateClassDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() order?: number;
}
class CreateStreamDto {
  @IsString() name!: string;
}

@Controller()
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get('schools/:schoolId/classes')
  list(@CurrentUser() user: AuthUser, @Param('schoolId') schoolId: string) {
    return this.classes.listForSchool(user, schoolId);
  }

  @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR)
  @Post('schools/:schoolId/classes')
  create(@CurrentUser() user: AuthUser, @Param('schoolId') schoolId: string, @Body() dto: CreateClassDto) {
    return this.classes.create(user, schoolId, dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR)
  @Patch('classes/:id')
  update(@Param('id') id: string, @Body() dto: UpdateClassDto) {
    return this.classes.update(id, dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR)
  @Delete('classes/:id')
  remove(@Param('id') id: string) {
    return this.classes.remove(id);
  }

  @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR)
  @Post('classes/:classId/streams')
  createStream(@Param('classId') classId: string, @Body() dto: CreateStreamDto) {
    return this.classes.createStream(classId, dto.name);
  }
}
