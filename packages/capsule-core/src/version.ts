import type { CapsuleVersion, Section } from '@threadcap/shared-types';
import { contentHash } from './hash.js';
import { diffSections, generateChangeSummary } from './diff.js';

/**
 * Produce the next immutable version for a capsule.
 * Inline edit → vN+1 with an auto-generated change_summary (docs/03-capsule-schema.md §7).
 */
export async function buildNextVersion(input: {
  capsuleId: string;
  versionNumber: number;
  parentId: string | null;
  prevSections: readonly Section[];
  nextSections: readonly Section[];
}): Promise<CapsuleVersion> {
  const hash = await contentHash(input.nextSections);
  const changes = diffSections(input.prevSections, input.nextSections);
  const changeSummary = generateChangeSummary(changes);
  return {
    id: `ver_${crypto.randomUUID().replaceAll('-', '')}` as CapsuleVersion['id'],
    capsuleId: input.capsuleId as CapsuleVersion['capsuleId'],
    versionNumber: input.versionNumber,
    parentId: input.parentId as CapsuleVersion['parentId'],
    sections: [...input.nextSections],
    contentHash: hash,
    changeSummary,
    createdAt: new Date().toISOString(),
  };
}