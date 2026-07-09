import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ExportService } from './export.service';
import { AnalyticsService } from './analytics.service';
import { StudentsModule } from '../students/students.module';

@Module({
  imports: [StudentsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ExportService, AnalyticsService],
})
export class ReportsModule {}
