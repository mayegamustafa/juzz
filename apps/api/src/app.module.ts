import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { SchoolsModule } from './schools/schools.module';
import { ClassesModule } from './classes/classes.module';
import { TeachersModule } from './teachers/teachers.module';
import { StudentsModule } from './students/students.module';
import { QuranModule } from './quran/quran.module';
import { AttendanceModule } from './attendance/attendance.module';
import { TargetsModule } from './targets/targets.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SyncModule } from './sync/sync.module';
import { AppReleaseModule } from './app-release/app-release.module';
import { SetupModule } from './setup/setup.module';

import { JwtAuthGuard, RolesGuard } from './common/guards';
import { AuditInterceptor } from './common/audit.interceptor';
import { IdempotencyInterceptor } from './common/idempotency.interceptor';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    JwtModule.register({}),
    PrismaModule,
    AuthModule,
    SchoolsModule,
    ClassesModule,
    TeachersModule,
    StudentsModule,
    QuranModule,
    AttendanceModule,
    TargetsModule,
    ReportsModule,
    NotificationsModule,
    SyncModule,
    AppReleaseModule,
    SetupModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Idempotency runs before Audit so a replayed request is short-circuited
    // and not logged twice.
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
