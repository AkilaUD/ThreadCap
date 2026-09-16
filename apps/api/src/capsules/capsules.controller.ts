import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CreateCapsuleRequest, CapsuleDTO } from '@threadcap/shared-types';
import { ApiError } from '../common/error.filter.js';
import { CapsulesService } from './capsules.service.js';

@Controller('capsules')
export class CapsulesController {
  constructor(private readonly service: CapsulesService) {}

  @Get()
  async list(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<{ items: CapsuleDTO[]; meta: { nextCursor: string | null; total: number } }> {
    const parsed = limit === undefined ? 25 : Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new ApiError('VALIDATION_ERROR', 'limit must be a positive integer', 400);
    }
    return this.service.list(cursor, parsed);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<CapsuleDTO> {
    return this.service.get(id);
  }

  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown): Promise<unknown> {
    const parsed = CreateCapsuleRequest.safeParse(body);
    if (!parsed.success) {
      throw new ApiError('VALIDATION_ERROR', 'request body is invalid', 400, parsed.error.flatten());
    }
    return this.service.create(parsed.data);
  }
}