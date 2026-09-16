import type { CapsuleDTO, CapsuleVersion, CreateCapsuleRequest } from '@threadcap/shared-types';

export interface CapsuleRepository {
  save(capsule: CapsuleDTO, version?: CapsuleVersion): Promise<void>;
  findById(id: string): Promise<CapsuleDTO | undefined>;
  list(cursor?: string, limit?: number): Promise<{ items: CapsuleDTO[]; nextCursor: string | null; total: number }>;
}

/**
 * MVP in-memory repository; replaced by the Postgres repository
 * (schema in infrastructure/db/migrations, see docs/02-data-model.md §2).
 */
export class InMemoryCapsuleRepository implements CapsuleRepository {
  private store = new Map<string, CapsuleDTO>();
  private versions = new Map<string, CapsuleVersion[]>();

  async save(capsule: CapsuleDTO, version?: CapsuleVersion): Promise<void> {
    this.store.set(capsule.id, capsule);
    if (version) {
      const list = this.versions.get(capsule.id) ?? [];
      list.push(version);
      this.versions.set(capsule.id, list);
    }
  }

  async findById(id: string): Promise<CapsuleDTO | undefined> {
    return this.store.get(id);
  }

  async list(cursor?: string, limit = 25): Promise<{ items: CapsuleDTO[]; nextCursor: string | null; total: number }> {
    const all = [...this.store.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const offset = cursor ? Number(cursor) : 0;
    const slice = all.slice(offset, offset + limit);
    const nextCursor = offset + slice.length < all.length ? String(offset + slice.length) : null;
    return { items: slice, nextCursor, total: all.length };
  }

  /** Seeded sample data so dev/demo surfaces have something to read. */
  static withSeed(): InMemoryCapsuleRepository {
    const now = Date.now();
    const seed: CapsuleDTO = {
      id: 'cap_demo00000000000000000001',
      workspaceId: 'ws_demo00000000000000000001',
      projectRef: 'threadcap',
      status: 'active',
      tags: ['docs', 'spec'],
      summary: 'ThreadCap implementation spec — free-first stack (D-020).',
      captureMode: 'file',
      title: 'ThreadCap spec',
      sections: [
        { id: 's_sum', kind: 'summary', name: 'Summary', content: 'Capsule-based context OS for AI. Never start from zero again.' },
        { id: 's_dec', kind: 'decisions', name: 'Decisions', content: 'D-020 free-first hosting · D-021 merged api+mcp service.' },
      ],
      createdAt: new Date(now - 3600_000).toISOString(),
      updatedAt: new Date(now - 3600_000).toISOString(),
    };
    const repo = new InMemoryCapsuleRepository();
    void repo.save(seed);
    return repo;
  }
}

export { CapsuleDTO, CapsuleVersion, CreateCapsuleRequest };