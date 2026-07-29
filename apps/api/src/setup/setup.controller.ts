import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators';
import { SetupService } from './setup.service';
import { BootstrapDto } from './setup.dto';

@Controller('setup')
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  @Public()
  @Get('status')
  status() {
    return this.setup.status();
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('bootstrap')
  bootstrap(@Body() dto: BootstrapDto) {
    return this.setup.bootstrap(dto);
  }
}
