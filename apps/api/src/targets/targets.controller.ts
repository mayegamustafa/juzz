import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { TargetScope, TargetUnit } from '@prisma/client';
import { TargetsService } from './targets.service';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';
import { ADMIN_ROLES } from '../common/scope';

class CreateTermDto {
  @IsString() name!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class UpdateTermDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class CreateTargetDto {
  @IsString() termId!: string;
  @IsIn(['ORGANIZATION', 'SCHOOL', 'CLASS', 'STUDENT']) scope!: TargetScope;
  @IsIn(['JUZ', 'SURAH', 'AYAH']) unit!: TargetUnit;
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() studentId?: string;
}
class UpdateTargetDto {
  @IsOptional() @IsString() termId?: string;
  @IsOptional() @IsIn(['ORGANIZATION', 'SCHOOL', 'CLASS', 'STUDENT']) scope?: TargetScope;
  @IsOptional() @IsIn(['JUZ', 'SURAH', 'AYAH']) unit?: TargetUnit;
  @IsOptional() @IsNumber() @Min(0) amount?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() studentId?: string;
}

@Controller()
export class TargetsController {
  constructor(private readonly targets: TargetsService) {}

  // ---------- terms ----------

  @Get('terms')
  terms(@CurrentUser() user: AuthUser) {
    return this.targets.listTerms(user);
  }

  @Roles(...ADMIN_ROLES)
  @Post('terms')
  createTerm(@CurrentUser() user: AuthUser, @Body() dto: CreateTermDto) {
    return this.targets.createTerm(user, dto);
  }

  @Roles(...ADMIN_ROLES)
  @Patch('terms/:id')
  updateTerm(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTermDto) {
    return this.targets.updateTerm(user, id, dto);
  }

  @Roles(...ADMIN_ROLES)
  @Post('terms/:id/activate')
  activateTerm(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.targets.activateTerm(user, id);
  }

  @Roles(...ADMIN_ROLES)
  @Delete('terms/:id')
  removeTerm(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.targets.removeTerm(user, id);
  }

  // ---------- targets ----------

  @Get('targets')
  list(@CurrentUser() user: AuthUser, @Query('termId') termId?: string) {
    return this.targets.listTargets(user, termId);
  }

  @Get('students/:studentId/targets')
  forStudent(@CurrentUser() user: AuthUser, @Param('studentId') studentId: string) {
    return this.targets.targetsForStudent(user, studentId);
  }

  @Roles(...ADMIN_ROLES)
  @Post('targets')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTargetDto) {
    return this.targets.createTarget(user, dto);
  }

  @Roles(...ADMIN_ROLES)
  @Patch('targets/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTargetDto) {
    return this.targets.updateTarget(user, id, dto);
  }

  @Roles(...ADMIN_ROLES)
  @Delete('targets/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.targets.removeTarget(user, id);
  }
}
