import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Role } from '@prisma/client';
import { QuranService } from './quran.service';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';

class MemorizationDto {
  @IsString() studentId!: string;
  @IsString() surahId!: string;
  @IsOptional() @IsNumber() fraction?: number;
  @IsOptional() @IsString() memorizedAt?: string;
}
class BulkMemorizationDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => MemorizationDto)
  items!: MemorizationDto[];
}
class RemarkDto {
  @IsString() body!: string;
}
class RevisionDto {
  @IsString() studentId!: string;
  @IsOptional() @IsString() surahId?: string;
  @IsOptional() @IsNumber() juz?: number;
  @IsOptional() @IsNumber() performanceScore?: number;
  @IsOptional() @IsString() revisedAt?: string;
  @IsOptional() @IsString() note?: string;
}
class AssessmentDto {
  @IsString() studentId!: string;
  @IsOptional() @IsIn(['EXCELLENT', 'VERY_GOOD', 'GOOD', 'FAIR', 'POOR']) grade?: string;
  @IsOptional() @IsNumber() score?: number;
  @IsOptional() @IsString() assessedAt?: string;
  @IsOptional() @IsString() note?: string;
}
class MistakeDto {
  @IsString() studentId!: string;
  @IsIn(['TAJWEED', 'MEMORIZATION', 'PRONUNCIATION']) type!: string;
  @IsOptional() @IsNumber() count?: number;
  @IsOptional() @IsString() surahId?: string;
  @IsOptional() @IsString() occurredAt?: string;
  @IsOptional() @IsString() note?: string;
}

function parseJuz(juz?: string): number[] | undefined {
  if (!juz) return undefined;
  return juz.split(',').map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
}

@Controller()
export class QuranController {
  constructor(private readonly quran: QuranService) {}

  @Get('surahs')
  surahs(@Query('juz') juz?: string) {
    return this.quran.listSurahs(parseJuz(juz));
  }

  @Get('quran/grid')
  grid(
    @CurrentUser() user: AuthUser,
    @Query('classId') classId?: string,
    @Query('streamId') streamId?: string,
    @Query('juz') juz?: string,
  ) {
    return this.quran.grid(user, { classId, streamId, juz: parseJuz(juz) });
  }

  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.TEACHER)
  @Put('quran/memorization')
  upsert(@CurrentUser() user: AuthUser, @Body() dto: MemorizationDto) {
    return this.quran.upsertMemorization(user, dto);
  }

  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.TEACHER)
  @Post('quran/memorization/bulk')
  bulk(@CurrentUser() user: AuthUser, @Body() dto: BulkMemorizationDto) {
    return this.quran.bulkMemorization(user, dto.items);
  }

  @Get('students/:id/remarks')
  remarks(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quran.listRemarks(user, id);
  }

  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.TEACHER)
  @Post('students/:id/remarks')
  addRemark(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RemarkDto) {
    return this.quran.addRemark(user, id, dto.body);
  }

  // --- Revision ---
  @Get('students/:id/revisions')
  revisions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quran.listRevisions(user, id);
  }

  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.TEACHER)
  @Post('quran/revision')
  addRevision(@CurrentUser() user: AuthUser, @Body() dto: RevisionDto) {
    return this.quran.addRevision(user, dto);
  }

  // --- Assessment ---
  @Get('students/:id/assessments')
  assessments(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quran.listAssessments(user, id);
  }

  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.TEACHER)
  @Post('quran/assessment')
  addAssessment(@CurrentUser() user: AuthUser, @Body() dto: AssessmentDto) {
    return this.quran.addAssessment(user, dto);
  }

  // --- Mistakes ---
  @Get('students/:id/mistakes')
  mistakes(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quran.listMistakes(user, id);
  }

  @Roles(Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.TEACHER)
  @Post('quran/mistakes')
  addMistake(@CurrentUser() user: AuthUser, @Body() dto: MistakeDto) {
    return this.quran.addMistake(user, dto);
  }
}
