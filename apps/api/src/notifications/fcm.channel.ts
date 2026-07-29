import { Injectable, Logger } from '@nestjs/common';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationChannel, OutboundNotification } from './channels';

/**
 * Delivers notifications to phones through Firebase Cloud Messaging, so they
 * arrive even when the app is closed. Polling only ever worked while the app
 * was open; the OS push service is the only transport that survives the app
 * being swapped away or killed.
 *
 * Configured by FIREBASE_SERVICE_ACCOUNT (the service account JSON, raw or
 * base64). When that is unset the channel stays dormant and simply does
 * nothing, so a deployment without Firebase still runs: in-app notifications
 * and the existing poll continue to work.
 */
@Injectable()
export class FcmChannel implements NotificationChannel {
  readonly name = 'fcm';
  private readonly logger = new Logger('NotificationChannel:fcm');
  private readonly app: App | null;

  constructor(private readonly prisma: PrismaService) {
    this.app = this.initialise();
  }

  private initialise(): App | null {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
    if (!raw) {
      this.logger.log('FIREBASE_SERVICE_ACCOUNT not set; push notifications are disabled.');
      return null;
    }

    try {
      // Accept base64 too: some hosts mangle multi-line values.
      const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      const credentials = JSON.parse(json);

      // Reusing the app across hot reloads avoids "app already exists".
      const existing = getApps().find((a) => a.name === 'qpms-push');
      const app =
        existing ??
        initializeApp(
          {
            credential: cert({
              projectId: credentials.project_id,
              clientEmail: credentials.client_email,
              privateKey: String(credentials.private_key).replace(/\\n/g, '\n'),
            }),
          },
          'qpms-push',
        );

      this.logger.log(`Push enabled for Firebase project ${credentials.project_id}`);
      return app;
    } catch (e) {
      // A bad credential must not stop the API from booting.
      this.logger.error(`Could not initialise Firebase; push disabled: ${(e as Error).message}`);
      return null;
    }
  }

  async send(n: OutboundNotification): Promise<void> {
    if (!this.app) return;

    const devices = await this.prisma.deviceToken.findMany({
      where: { userId: n.recipientId },
      select: { token: true },
    });
    if (devices.length === 0) return;

    const tokens = devices.map((d) => d.token);
    const res = await getMessaging(this.app).sendEachForMulticast({
      tokens,
      notification: { title: n.title, body: n.body },
      // Mirrored into data so a background/terminated handler can route the tap.
      data: { type: n.type, title: n.title, body: n.body },
      android: {
        priority: 'high',
        notification: { channelId: 'qpms_default', priority: 'high' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });

    if (res.failureCount === 0) return;

    // Drop tokens FCM says are dead, otherwise they accumulate forever: phones
    // get wiped, apps get uninstalled, tokens get rotated.
    const dead: string[] = [];
    res.responses.forEach((r, i) => {
      const code = r.error?.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/invalid-argument'
      ) {
        dead.push(tokens[i]);
      }
    });

    if (dead.length > 0) {
      await this.prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });
      this.logger.log(`Removed ${dead.length} stale device token(s)`);
    }
    this.logger.warn(`${res.failureCount}/${tokens.length} push message(s) failed`);
  }
}
