import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';

class BroadcastDto {
  @IsString() @MaxLength(120) title!: string;
  @IsString() @MaxLength(2000) body!: string;
  @IsOptional() @IsIn(['INFO', 'ANNOUNCEMENT', 'REMINDER', 'ACHIEVEMENT', 'ALERT']) type?: string;
  @IsOptional() @IsString() schoolId?: string;
}

class DeviceDto {
  @IsString() @MaxLength(4096) token!: string;
  @IsOptional() @IsIn(['android', 'ios']) platform?: string;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('unread') unread?: string, @Query('limit') limit?: string) {
    return this.notifications.list(user, {
      unreadOnly: unread === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user);
  }

  @Post(':id/read')
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user);
  }

  @Post('devices')
  registerDevice(@CurrentUser() user: AuthUser, @Body() dto: DeviceDto) {
    return this.notifications.registerDevice(user, dto.token, dto.platform);
  }

  @Post('devices/remove')
  unregisterDevice(@Body() dto: DeviceDto) {
    return this.notifications.unregisterDevice(dto.token);
  }

  @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR)
  @Post('broadcast')
  broadcast(@CurrentUser() user: AuthUser, @Body() dto: BroadcastDto) {
    return this.notifications.broadcast(user, dto);
  }
}
