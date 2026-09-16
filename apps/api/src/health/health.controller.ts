import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; service: string; uptime: number } {
    return { status: 'ok', service: 'threadcap-api', uptime: process.uptime() };
  }
}