import { z } from 'zod';

export const ULID_PREFIXES = {
  user: 'usr_',
  workspace: 'ws_',
  team: 'tm_',
  project: 'prj_',
  capsule: 'cap_',
  version: 'ver_',
  attachment: 'att_',
  capture: 'csv_',
  injection: 'inje_',
  share: 'shr_',
  request: 'req_',
  key: 'cht_',
} as const;

export type UlidPrefix = (typeof ULID_PREFIXES)[keyof typeof ULID_PREFIXES];

/** Branded id helpers: `cap_…`, `usr_…`, `ver_…` etc. (see docs/00-index.md §3). */
export type UserId = `usr_${string}`;
export type WorkspaceId = `ws_${string}`;
export type TeamId = `tm_${string}`;
export type ProjectId = `prj_${string}`;
export type CapsuleId = `cap_${string}`;
export type VersionId = `ver_${string}`;
export type AttachmentId = `att_${string}`;
export type CaptureId = `csv_${string}`;
export type InjectionId = `inje_${string}`;
export type ShareId = `shr_${string}`;
export type ApiKeyId = `cht_${string}`;

const idSchema = <T extends string>(prefix: string): z.ZodType<T> =>
  z.string().regex(new RegExp(`^${prefix}[a-z0-9]+$`, 'i')) as unknown as z.ZodType<T>;

export const UserIdSchema = idSchema<UserId>('usr_');
export const WorkspaceIdSchema = idSchema<WorkspaceId>('ws_');
export const TeamIdSchema = idSchema<TeamId>('tm_');
export const ProjectIdSchema = idSchema<ProjectId>('prj_');
export const CapsuleIdSchema = idSchema<CapsuleId>('cap_');
export const VersionIdSchema = idSchema<VersionId>('ver_');
export const AttachmentIdSchema = idSchema<AttachmentId>('att_');
export const CaptureIdSchema = idSchema<CaptureId>('csv_');
export const InjectionIdSchema = idSchema<InjectionId>('inje_');
export const ShareIdSchema = idSchema<ShareId>('shr_');
export const ApiKeyIdSchema = idSchema<ApiKeyId>('cht_');

export function isPrefixedId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    Object.values(ULID_PREFIXES).some((p) => id.startsWith(p))
  );
}