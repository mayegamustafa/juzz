import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { TargetsService } from './targets.service';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';

class CreateTermDto {
  @IsString() name!: string;
  @IsString() startDate!: string;
  @IsString() endDate!: string;
}
class CreateTargetDto {
  @IsString() termId!: string;
  @IsIn(['ORGANIZATION', 'SCHOOL', 'CLASS']) scope!: string;
  @IsIn(['JUZ', 'SURAH', 'AYAH']) unit!: string;
  @IsNumber() amount!: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() schoolId?: string;
  @IsOptional() @IsString() classId?: string;
}

@Controller()
export class TargetsController {
  constructor(private readonly targets: TargetsService) {}

  @Get('terms')
  terms(@CurrentUser() user: AuthUser) {
    return this.targets.listTerms(user);
  }

  @Roles(Role.SUPER_ADMIN)
  @Post('terms')
  createTerm(@CurrentUser() user: AuthUser, @Body() dto: CreateTermDto) {
    return this.targets.createTerm(user, dto);
  }

  @Roles(Role.SUPER_ADMIN)
  @Patch('terms/:id')
  updateTerm(@Param('id') id: string, @Body() dto: Partial<CreateTermDto> & { isActive?: boolean }) {
    return this.targets.updateTerm(id, dto);
  }

  @Get('targets')
  list(@CurrentUser() user: AuthUser) {
    return this.targets.listTargets(user);
  }

  @Roles(Role.SUPER_ADMIN)
  @Post('targets')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTargetDto) {
    return this.targets.createTarget(user, dto as any);
  }
}
