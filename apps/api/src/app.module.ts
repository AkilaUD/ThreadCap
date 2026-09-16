import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HealthController } from './health/health.controller.js';
import { CapsulesModule } from './capsules/capsules.module.js';
import { BodyErrorFilter } from './common/error.filter.js';

@Module({
  imports: [CapsulesModule],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: BodyErrorFilter }],
})
export class AppModule {}