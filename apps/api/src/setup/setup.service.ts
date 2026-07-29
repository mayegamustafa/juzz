import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { BootstrapDto } from './setup.dto';

@Injectable()
export class SetupService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * True only before the very first account exists on this deployment, and
   * only if the operator opted in by setting SETUP_KEY. The moment one user
   * is created, this permanently reports false: there is no standing way to
   * create another admin from this page, by design.
   */
  async status() {
    const configured = !!process.env.SETUP_KEY;
    const userCount = await this.prisma.user.count();
    return { available: configured && userCount === 0 };
  }

  async bootstrap(dto: BootstrapDto) {
    const setupKey = process.env.SETUP_KEY;
    if (!setupKey) throw new ForbiddenException('Setup is not enabled on this server');
    if (dto.setupKey !== setupKey) throw new ForbiddenException('Incorrect setup key');

    const userCount = await this.prisma.user.count();
    if (userCount > 0) throw new ConflictException('Setup has already been completed on this server');

    const passwordHash = await argon2.hash(dto.password);

    const organization = await this.prisma.organization.create({
      data: { name: dto.organizationName, code: dto.organizationCode.toUpperCase() },
    });

    const user = await this.prisma.user.create({
      data: {
        organizationId: organization.id,
        role: 'SUPER_ADMIN',
        fullName: dto.fullName,
        email: dto.email.toLowerCase(),
        passwordHash,
      },
    });

    return { id: user.id, email: user.email, organizationId: organization.id };
  }
}
