import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get(['health', 'healthz'])
  check(): { status: string; service: string; uptime: number } {
    return { status: 'ok', service: 'threadcap-api', uptime: process.uptime() };
  }
}