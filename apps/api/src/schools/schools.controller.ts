import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { SchoolsService } from './schools.service';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';

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

  @Roles(Role.SUPER_ADMIN)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSchoolDto) {
    return this.schools.create(user, dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN)
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSchoolDto) {
    return this.schools.update(user, id, dto);
  }

  @Roles(Role.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.schools.remove(id);
  }
}
