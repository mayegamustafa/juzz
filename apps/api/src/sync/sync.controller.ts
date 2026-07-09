import { Controller, Get, Query } from '@nestjs/common';
import { SyncService } from './sync.service';
import { CurrentUser, AuthUser } from '../common/decorators';

function parseJuz(juz?: string): number[] | undefined {
  if (!juz) return undefined;
  const parsed = juz.split(',').map((n) => parseInt(n.trim(), 10)).filter((n) => n >= 1 && n <= 30);
  return parsed.length ? parsed : undefined;
}

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Get('bootstrap')
  bootstrap(@CurrentUser() user: AuthUser, @Query('juz') juz?: string) {
    return this.sync.bootstrap(user, parseJuz(juz));
  }
}
