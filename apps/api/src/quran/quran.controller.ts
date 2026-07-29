import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { QuranService } from './quran.service';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';
import { RECORDING_ROLES, ADMIN_ROLES } from '../common/scope';

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
class UpdateRevisionDto {
  @IsOptional() @IsNumber() performanceScore?: number;
  @IsOptional() @IsString() note?: string;
}
class AssessmentDto {
  @IsString() studentId!: string;
  @IsOptional() @IsIn(['EXCELLENT', 'VERY_GOOD', 'GOOD', 'FAIR', 'POOR']) grade?: string;
  @IsOptional() @IsNumber() score?: number;
  @IsOptional() @IsString() assessedAt?: string;
  @IsOptional() @IsString() note?: string;
}
class UpdateAssessmentDto {
  @IsOptional() @IsIn(['EXCELLENT', 'VERY_GOOD', 'GOOD', 'FAIR', 'POOR']) grade?: string;
  @IsOptional() @IsNumber() score?: number;
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
class UpdateMistakeDto {
  @IsOptional() @IsIn(['TAJWEED', 'MEMORIZATION', 'PRONUNCIATION']) type?: string;
  @IsOptional() @IsNumber() count?: number;
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

  @Roles(...RECORDING_ROLES)
  @Put('quran/memorization')
  upsert(@CurrentUser() user: AuthUser, @Body() dto: MemorizationDto) {
    return this.quran.upsertMemorization(user, dto);
  }

  @Roles(...RECORDING_ROLES)
  @Post('quran/memorization/bulk')
  bulk(@CurrentUser() user: AuthUser, @Body() dto: BulkMemorizationDto) {
    return this.quran.bulkMemorization(user, dto.items);
  }

  // --- Remarks ---
  @Get('students/:id/remarks')
  remarks(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quran.listRemarks(user, id);
  }

  @Roles(...RECORDING_ROLES)
  @Post('students/:id/remarks')
  addRemark(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RemarkDto) {
    return this.quran.addRemark(user, id, dto.body);
  }

  @Roles(...RECORDING_ROLES)
  @Patch('remarks/:id')
  updateRemark(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RemarkDto) {
    return this.quran.updateRemark(user, id, dto.body);
  }

  @Roles(...RECORDING_ROLES)
  @Delete('remarks/:id')
  removeRemark(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quran.removeRemark(user, id);
  }

  @Roles(...ADMIN_ROLES)
  @Post('remarks/:id/unlock')
  unlockRemark(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quran.unlockRemark(user, id);
  }

  // --- Revision ---
  @Get('students/:id/revisions')
  revisions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quran.listRevisions(user, id);
  }

  @Roles(...RECORDING_ROLES)
  @Post('quran/revision')
  addRevision(@CurrentUser() user: AuthUser, @Body() dto: RevisionDto) {
    return this.quran.addRevision(user, dto);
  }

  @Roles(...RECORDING_ROLES)
  @Patch('quran/revision/:id')
  updateRevision(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateRevisionDto) {
    return this.quran.updateRevision(user, id, dto);
  }

  @Roles(...RECORDING_ROLES)
  @Delete('quran/revision/:id')
  removeRevision(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quran.removeRevision(user, id);
  }

  @Roles(...ADMIN_ROLES)
  @Post('quran/revision/:id/unlock')
  unlockRevision(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quran.unlockRevision(user, id);
  }

  // --- Assessment ---
  @Get('students/:id/assessments')
  assessments(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quran.listAssessments(user, id);
  }

  @Roles(...RECORDING_ROLES)
  @Post('quran/assessment')
  addAssessment(@CurrentUser() user: AuthUser, @Body() dto: AssessmentDto) {
    return this.quran.addAssessment(user, dto);
  }

  @Roles(...RECORDING_ROLES)
  @Patch('quran/assessment/:id')
  updateAssessment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAssessmentDto) {
    return this.quran.updateAssessment(user, id, dto);
  }

  @Roles(...RECORDING_ROLES)
  @Delete('quran/assessment/:id')
  removeAssessment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quran.removeAssessment(user, id);
  }

  @Roles(...ADMIN_ROLES)
  @Post('quran/assessment/:id/unlock')
  unlockAssessment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quran.unlockAssessment(user, id);
  }

  // --- Mistakes ---
  @Get('students/:id/mistakes')
  mistakes(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quran.listMistakes(user, id);
  }

  @Roles(...RECORDING_ROLES)
  @Post('quran/mistakes')
  addMistake(@CurrentUser() user: AuthUser, @Body() dto: MistakeDto) {
    return this.quran.addMistake(user, dto);
  }

  @Roles(...RECORDING_ROLES)
  @Patch('quran/mistakes/:id')
  updateMistake(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateMistakeDto) {
    return this.quran.updateMistake(user, id, dto);
  }

  @Roles(...RECORDING_ROLES)
  @Delete('quran/mistakes/:id')
  removeMistake(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quran.removeMistake(user, id);
  }

  @Roles(...ADMIN_ROLES)
  @Post('quran/mistakes/:id/unlock')
  unlockMistake(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.quran.unlockMistake(user, id);
  }
}
