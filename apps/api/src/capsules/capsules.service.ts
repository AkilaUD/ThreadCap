import { Injectable } from '@nestjs/common';
import { CreateCapsuleRequest, CapsuleDTO, CapsuleVersion } from '@threadcap/shared-types';
import { buildNextVersion, estimateTokens, captureTokenCost } from '@threadcap/capsule-core';
import { badRequest, notFound } from '../common/error.filter.js';
import { InMemoryCapsuleRepository } from './capsule.repository.js';

const newPrefixedId = (prefix: string) => `${prefix}${crypto.randomUUID().replaceAll('-', '')}`;

@Injectable()
export class CapsulesService {
  constructor(private readonly repo: InMemoryCapsuleRepository) {}

  async create(input: CreateCapsuleRequest): Promise<{ capsule: CapsuleDTO; version: CapsuleVersion }> {
    if (input.messages.length > 500) {
      throw badRequest('VALIDATION_ERROR', 'messages > 500 not allowed (M-4)', { count: input.messages.length });
    }
    if (captureTokenCost(input.messages) > 1_000_000) {
      throw badRequest('VALIDATION_ERROR', 'capture payload exceeds 1M approximate tokens');
    }

    const now = new Date().toISOString();
    const sections = toSections(input.title, input.messages);
    const capsule: CapsuleDTO = {
      id: newPrefixedId('cap_'),
      workspaceId: input.workspaceId,
      projectRef: input.projectRef ?? null,
      status: 'draft',
      tags: [],
      summary: '',
      captureMode: input.messages.length ? 'raw' : 'api',
      title: input.title ?? 'Untitled',
      sections,
      createdAt: now,
      updatedAt: now,
    };
    const version = await buildNextVersion({
      capsuleId: capsule.id,
      versionNumber: 1,
      parentId: null,
      prevSections: [],
      nextSections: sections,
    });

    await this.repo.save(capsule, version);
    return { capsule, version };
  }

  async get(id: string): Promise<CapsuleDTO> {
    const capsule = await this.repo.findById(id);
    if (!capsule) throw notFound('CAPSULE_NOT_FOUND', `capsule ${id} not found`);
    return capsule;
  }

  async list(cursor?: string, limit = 25): Promise<{ items: CapsuleDTO[]; meta: { nextCursor: string | null; total: number } }> {
    const page = await this.repo.list(cursor, Math.min(limit, 100));
    return { items: page.items, meta: { nextCursor: page.nextCursor, total: page.total } };
  }
}

function toSections(title: string | undefined, messages: CreateCapsuleRequest['messages']): CapsuleDTO['sections'] {
  const sections: CapsuleDTO['sections'] = [];
  sections.push({
    id: 's_sum',
    kind: 'summary',
    name: 'Summary',
    content: title ? `Topic: ${title}` : 'Captured transcript',
  });
  if (messages.length) {
    const transcript = messages.map((m) => `[${m.role}] ${m.content}`).join('\n');
    sections.push({
      id: 's_transcript',
      kind: 'story',
      name: 'Transcript',
      content: transcript,
      tokens: estimateTokens(transcript),
    });
  }
  for (const s of sections) s.tokens = s.tokens ?? estimateTokens(s.content);
  return sections;
}