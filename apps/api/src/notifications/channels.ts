import { Injectable, Logger } from '@nestjs/common';

export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');

export interface OutboundNotification {
  recipientId: string;
  title: string;
  body: string;
  type: string;
}

/**
 * A delivery channel. In-app storage always happens; channels are *additional*
 * transports (push / email / SMS). Add an implementation and register it in
 * `NotificationsModule` — no other code needs to change.
 */
export interface NotificationChannel {
  readonly name: string;
  send(n: OutboundNotification): Promise<void>;
}

/** Default channel: records dispatch attempts. Replace/augment with FCM, SES, Twilio, etc. */
@Injectable()
export class LogChannel implements NotificationChannel {
  readonly name = 'log';
  private readonly logger = new Logger('NotificationChannel:log');

  async send(n: OutboundNotification): Promise<void> {
    this.logger.log(`[${n.type}] -> ${n.recipientId}: ${n.title}`);
  }
}
