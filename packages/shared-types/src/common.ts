import { z } from 'zod';

/** SCREAMING_SNAKE error codes (docs/04-api-contracts.md §1.3, docs/00-index.md §3). */
export const ErrorCode = z.enum([
  'INVALID_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'TOKEN_EXPIRED',
  'NOT_FOUND',
  'CAPSULE_NOT_FOUND',
  'VERSION_NOT_FOUND',
  'CAPSULE_UNCHANGED',
  'INJECTION_DUPLICATE',
  'TOO_MANY_ACTIVE',
  'PLAN_REQUIRED',
  'RATE_LIMITED',
  'VALIDATION_ERROR',
  'INVALID_API_KEY',
  'AI_PROVIDER_NOT_CONFIGURED',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorEnvelope = z.object({
  requestId: z.string(),
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;

export const PaginationMeta = z.object({
  nextCursor: z.string().nullish(),
  total: z.number().int().nonnegative(),
});
export type PaginationMeta = z.infer<typeof PaginationMeta>;

/** Cursor-page envelope: `{ items, meta: { nextCursor, total } }` (docs/04-api-contracts.md §1.2). */
export const CursorPage = <T extends z.ZodTypeAny>(items: T) =>
  z.object({
    items: z.array(items),
    meta: PaginationMeta,
  });
export type CursorPage<T> = {
  items: T[];
  meta: PaginationMeta;
};