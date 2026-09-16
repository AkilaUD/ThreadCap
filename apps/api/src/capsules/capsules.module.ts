import { Module } from '@nestjs/common';
import { CapsulesController } from './capsules.controller.js';
import { CapsulesService } from './capsules.service.js';
import { InMemoryCapsuleRepository } from './capsule.repository.js';

@Module({
  controllers: [CapsulesController],
  providers: [
    { provide: InMemoryCapsuleRepository, useFactory: () => InMemoryCapsuleRepository.withSeed() },
    CapsulesService,
  ],
})
export class CapsulesModule {}