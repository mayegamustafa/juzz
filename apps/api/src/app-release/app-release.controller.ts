import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { AppReleaseService } from './app-release.service';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';
import { ADMIN_ROLES } from '../common/scope';

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

  @Roles(...ADMIN_ROLES)
  @Post()
  publish(@CurrentUser() user: AuthUser, @Body() dto: PublishReleaseDto) {
    return this.releases.publish(user, dto);
  }
}
