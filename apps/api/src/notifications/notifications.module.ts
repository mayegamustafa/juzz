import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { LogChannel, NOTIFICATION_CHANNELS } from './channels';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    LogChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (log: LogChannel) => [log],
      inject: [LogChannel],
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
