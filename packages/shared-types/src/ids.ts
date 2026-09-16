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

export function isPrefixedId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    Object.values(ULID_PREFIXES).some((p) => id.startsWith(p))
  );
}