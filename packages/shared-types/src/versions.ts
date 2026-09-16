import { z } from 'zod';
import { Section, SectionRef } from './capsule.js';
import { CapsuleId, VersionId } from './ids.js';

export const CapsuleVersion = z.object({
  id: VersionId,
  capsuleId: CapsuleId,
  versionNumber: z.number().int().positive(),
  parentId: VersionId.nullable(),
  sections: z.array(Section),
  contentHash: z.string(),
  changeSummary: z.string().default(''),
  createdAt: z.string().datetime(),
});
export type CapsuleVersion = z.infer<typeof CapsuleVersion>;

/** Section-level change descriptors produced by version diffs. */
export const SectionChange = z.object({
  op: z.enum(['added', 'removed', 'modified', 'unchanged']),
  ref: SectionRef,
  was: Section.optional(),
  now: Section.optional(),
});
export type SectionChange = z.infer<typeof SectionChange>;