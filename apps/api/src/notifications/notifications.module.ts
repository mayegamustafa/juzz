import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { LogChannel, NOTIFICATION_CHANNELS } from './channels';
import { FcmChannel } from './fcm.channel';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    LogChannel,
    FcmChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      // FcmChannel is a no-op unless FIREBASE_SERVICE_ACCOUNT is configured.
      useFactory: (log: LogChannel, fcm: FcmChannel) => [log, fcm],
      inject: [LogChannel, FcmChannel],
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
