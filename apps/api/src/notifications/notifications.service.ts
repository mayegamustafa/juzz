import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';
import { isOrgWide } from '../common/scope';
import { NOTIFICATION_CHANNELS, NotificationChannel } from './channels';

export type NotifyInput = { recipientId: string; title: string; body: string; type?: string; schoolId?: string };

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_CHANNELS) private readonly channels: NotificationChannel[],
  ) {}

  /** Internal: create one in-app notification and fan out to delivery channels. */
  async notify(input: NotifyInput) {
    const row = await this.prisma.notification.create({
      data: {
        recipientId: input.recipientId,
        schoolId: input.schoolId,
        title: input.title,
        body: input.body,
        type: input.type ?? 'INFO',
      },
    });
    await this.dispatch([{ ...input, type: row.type }]);
    return row;
  }

  private async dispatch(items: { recipientId: string; title: string; body: string; type: string }[]) {
    await Promise.all(
      items.flatMap((n) =>
        this.channels.map((c) =>
          c.send(n).catch((e) => this.logger.warn(`channel ${c.name} failed: ${e.message}`)),
        ),
      ),
    );
  }

  /** Admin announcement. Fans out one row per recipient so read-state is per user. */
  async broadcast(
    user: AuthUser,
    data: { title: string; body: string; type?: string; schoolId?: string },
  ) {
    const allowed: Role[] = [Role.SUPER_ADMIN, Role.SUPERVISOR, Role.SCHOOL_ADMIN];
    if (!allowed.includes(user.role)) {
      throw new ForbiddenException('Not allowed to broadcast');
    }
    // A school admin can only target their own school.
    const schoolId = isOrgWide(user) ? data.schoolId : (user.schoolId ?? undefined);
    if (!isOrgWide(user) && !schoolId) throw new ForbiddenException('No school scope');

    const recipients = await this.prisma.user.findMany({
      where: {
        isActive: true,
        organizationId: user.organizationId,
        ...(schoolId ? { schoolId } : {}),
      },
      select: { id: true },
    });
    if (recipients.length === 0) return { created: 0 };

    const type = data.type ?? 'ANNOUNCEMENT';
    await this.prisma.notification.createMany({
      data: recipients.map((r) => ({
        recipientId: r.id,
        schoolId,
        title: data.title,
        body: data.body,
        type,
      })),
    });
    await this.dispatch(recipients.map((r) => ({ recipientId: r.id, title: data.title, body: data.body, type })));
    return { created: recipients.length };
  }

  list(user: AuthUser, opts: { unreadOnly?: boolean; limit?: number } = {}) {
    return this.prisma.notification.findMany({
      where: { recipientId: user.id, ...(opts.unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(opts.limit ?? 50, 100),
    });
  }

  async unreadCount(user: AuthUser) {
    const count = await this.prisma.notification.count({ where: { recipientId: user.id, readAt: null } });
    return { count };
  }

  async markRead(user: AuthUser, id: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n) throw new NotFoundException();
    if (n.recipientId !== user.id) throw new ForbiddenException();
    if (n.readAt) return n;
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(user: AuthUser) {
    const res = await this.prisma.notification.updateMany({
      where: { recipientId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }
}
