import { z } from 'zod';
import { CapsuleId, WorkspaceId } from './ids.js';

export const CapsuleStatus = z.enum(['draft', 'active', 'archived']);
export type CapsuleStatus = z.infer<typeof CapsuleStatus>;

export const SectionKind = z.enum([
  'summary',
  'story',
  'people',
  'requirements',
  'decisions',
  'references',
  'next',
]);
export type SectionKind = z.infer<typeof SectionKind>;

export const SectionRef = z.object({
  id: z.string(),
  kind: SectionKind,
  name: z.string(),
  anchor: z.string().optional(),
});
export type SectionRef = z.infer<typeof SectionRef>;

export const Section = z.object({
  id: z.string(),
  kind: SectionKind,
  name: z.string(),
  content: z.string(),
  tokens: z.number().int().nonnegative().optional(),
});
export type Section = z.infer<typeof Section>;

/** A captured conversation message entering the pipeline (raw capture). */
export const CaptureMessage = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
  ts: z.string().datetime().optional(),
});
export type CaptureMessage = z.infer<typeof CaptureMessage>;

export const CapsuleDTO = z.object({
  id: CapsuleId,
  workspaceId: WorkspaceId,
  projectRef: z.string().nullable(),
  status: CapsuleStatus,
  tags: z.array(z.string()).default([]),
  summary: z.string().default(''),
  captureMode: z
    .enum(['raw', 'smart', 'paste', 'sdk', 'file', 'api'])
    .default('api'),
  title: z.string().default('Untitled'),
  sections: z.array(Section).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CapsuleDTO = z.infer<typeof CapsuleDTO>;

export const CreateCapsuleRequest = z.object({
  workspaceId: WorkspaceId,
  title: z.string().trim().min(1).max(200).optional(),
  projectRef: z.string().max(120).nullable().optional(),
  messages: z.array(CaptureMessage).max(500).default([]),
  sources: z.array(z.string()).default([]),
});
export type CreateCapsuleRequest = z.infer<typeof CreateCapsuleRequest>;

export const UpdateCapsuleRequest = z.object({
  status: CapsuleStatus.optional(),
  tags: z.array(z.string()).max(20).optional(),
  summary: z.string().max(1000).optional(),
  title: z.string().trim().min(1).max(200).optional(),
});
export type UpdateCapsuleRequest = z.infer<typeof UpdateCapsuleRequest>;