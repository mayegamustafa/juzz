import { Module } from '@nestjs/common';
import { AppReleaseController } from './app-release.controller';
import { AppReleaseService } from './app-release.service';

@Module({
  controllers: [AppReleaseController],
  providers: [AppReleaseService],
})
export class AppReleaseModule {}
