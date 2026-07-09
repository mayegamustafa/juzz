import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { ExportService } from './export.service';
import { AnalyticsService } from './analytics.service';
import { CurrentUser, AuthUser } from '../common/decorators';

function parseJuz(juz?: string): number[] | undefined {
  if (!juz) return undefined;
  return juz.split(',').map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
}

function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

@Controller()
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly exporter: ExportService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Get('reports/general')
  general(
    @CurrentUser() user: AuthUser,
    @Query('level') level?: string,
    @Query('schoolId') schoolId?: string,
    @Query('juz') juz?: string,
  ) {
    return this.reports.general(user, { level, schoolId, juz: parseJuz(juz) });
  }

  @Get('reports/general/export')
  async generalExport(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('format') format = 'xlsx',
    @Query('level') level = 'P.1',
    @Query('schoolId') schoolId?: string,
    @Query('juz') juz?: string,
  ) {
    const data = await this.reports.general(user, { level, schoolId, juz: parseJuz(juz) });
    const name = `general-rollup-${slug(level)}`;
    if (format === 'pdf') {
      const buf = await this.exporter.generalPdf(data, level);
      return this.send(res, buf, `${name}.pdf`, 'application/pdf');
    }
    const buf = await this.exporter.generalXlsx(data, level);
    return this.send(res, buf, `${name}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  @Get('reports/student/:id/export')
  async studentExport(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Param('id') id: string,
    @Query('format') format = 'pdf',
  ) {
    const rep = await this.reports.student(user, id);
    const name = `student-report-${slug(rep.student.fullName)}`;
    if (format === 'xlsx') {
      const buf = await this.exporter.studentXlsx(rep);
      return this.send(res, buf, `${name}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }
    const buf = await this.exporter.studentPdf(rep);
    return this.send(res, buf, `${name}.pdf`, 'application/pdf');
  }

  @Get('reports/student/:id')
  student(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reports.student(user, id);
  }

  @Get('analytics/dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.reports.dashboard(user);
  }

  @Get('analytics/overview')
  overview(
    @CurrentUser() user: AuthUser,
    @Query('schoolId') schoolId?: string,
    @Query('level') level?: string,
  ) {
    return this.analytics.overview(user, { schoolId, level });
  }

  @Get('leaderboards')
  leaderboard(@CurrentUser() user: AuthUser, @Query('type') type?: string) {
    return this.reports.leaderboard(user, type === 'schools' ? 'schools' : 'students');
  }

  private send(res: Response, buf: Buffer, filename: string, contentType: string) {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  }
}
