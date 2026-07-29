import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';
import { isOrgWide } from '../common/scope';

const ROW_ID = 'mobile';

@Injectable()
export class AppReleaseService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public (any authenticated user, i.e. after login). Returns null if no
   * release has ever been published — the app should then assume it is current.
   */
  current() {
    return this.prisma.appRelease.findUnique({ where: { id: ROW_ID } });
  }

  /**
   * The secretariat publishes this after every Codemagic build: paste the
   * artifact link, bump the version, and every installed app is offered the
   * update next time it opens. Installing over the existing APK (same package,
   * same signing key) updates in place — no uninstall, no data loss.
   */
  async publish(
    user: AuthUser,
    data: {
      versionCode: number;
      versionName: string;
      downloadUrl: string;
      releaseNotes?: string;
      mandatory?: boolean;
    },
  ) {
    if (!isOrgWide(user)) throw new ForbiddenException('Only the secretariat may publish a release');
    return this.prisma.appRelease.upsert({
      where: { id: ROW_ID },
      update: {
        versionCode: data.versionCode,
        versionName: data.versionName,
        downloadUrl: data.downloadUrl,
        releaseNotes: data.releaseNotes,
        mandatory: data.mandatory ?? false,
        publishedById: user.id,
      },
      create: {
        id: ROW_ID,
        versionCode: data.versionCode,
        versionName: data.versionName,
        downloadUrl: data.downloadUrl,
        releaseNotes: data.releaseNotes,
        mandatory: data.mandatory ?? false,
        publishedById: user.id,
      },
    });
  }
}
