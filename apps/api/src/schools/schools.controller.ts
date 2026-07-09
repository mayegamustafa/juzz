import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { SchoolsService } from './schools.service';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';
import { ADMIN_ROLES } from '../common/scope';

class CreateSchoolDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() location?: string;
}
class UpdateSchoolDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Controller('schools')
export class SchoolsController {
  constructor(private readonly schools: SchoolsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.schools.list(user);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.schools.get(user, id);
  }

  @Roles(...ADMIN_ROLES)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSchoolDto) {
    return this.schools.create(user, dto);
  }

  @Roles(...ADMIN_ROLES)
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSchoolDto) {
    return this.schools.update(user, id, dto);
  }

  @Roles(...ADMIN_ROLES)
  @Post(':id/archive')
  archive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.schools.setArchived(user, id, true);
  }

  @Roles(...ADMIN_ROLES)
  @Post(':id/restore')
  restore(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.schools.setArchived(user, id, false);
  }

  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.schools.remove(user, id);
  }
}
