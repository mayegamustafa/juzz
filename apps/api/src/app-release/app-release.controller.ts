import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { AppReleaseService } from './app-release.service';
import { Role } from '@prisma/client';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';

class PublishReleaseDto {
  @IsInt() @Min(1) versionCode!: number;
  @IsString() versionName!: string;
  @IsUrl({ require_tld: false }) downloadUrl!: string;
  @IsOptional() @IsString() releaseNotes?: string;
  @IsOptional() @IsBoolean() mandatory?: boolean;
}

@Controller('app-release')
export class AppReleaseController {
  constructor(private readonly releases: AppReleaseService) {}

  @Get()
  current() {
    return this.releases.current();
  }

  // Deployment configuration rather than day-to-day administration: publishing
  // a bad build reaches every Sheikh's phone, so it stays with the system owner
  // even though supervisors administer everything else.
  @Roles(Role.SUPER_ADMIN)
  @Post()
  publish(@CurrentUser() user: AuthUser, @Body() dto: PublishReleaseDto) {
    return this.releases.publish(user, dto);
  }
}
