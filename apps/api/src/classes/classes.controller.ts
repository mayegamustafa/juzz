import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { ClassesService } from './classes.service';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';
import { ADMIN_ROLES } from '../common/scope';

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

  @Roles(...ADMIN_ROLES)
  @Post('schools/:schoolId/classes')
  create(@CurrentUser() user: AuthUser, @Param('schoolId') schoolId: string, @Body() dto: CreateClassDto) {
    return this.classes.create(user, schoolId, dto);
  }

  @Roles(...ADMIN_ROLES)
  @Patch('classes/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateClassDto) {
    return this.classes.update(user, id, dto);
  }

  @Roles(...ADMIN_ROLES)
  @Delete('classes/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.classes.remove(user, id);
  }

  @Roles(...ADMIN_ROLES)
  @Post('classes/:classId/streams')
  createStream(@CurrentUser() user: AuthUser, @Param('classId') classId: string, @Body() dto: CreateStreamDto) {
    return this.classes.createStream(user, classId, dto.name);
  }

  @Roles(...ADMIN_ROLES)
  @Delete('streams/:id')
  removeStream(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.classes.removeStream(user, id);
  }
}
