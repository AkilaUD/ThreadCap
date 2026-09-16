import { z } from 'zod';
import { ApiKeyId } from './ids.js';

/** Introspection response for MCP/skills `cht_*` keys (docs/06-mcp.md). */
export const KeyIntrospect = z.object({
  keyId: ApiKeyId,
  name: z.string(),
  scopes: z.array(z.string()).default([]),
  lastUsedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type KeyIntrospect = z.infer<typeof KeyIntrospect>;

export const PlanTier = z.enum(['free', 'pro', 'team', 'enterprise']);
export type PlanTier = z.infer<typeof PlanTier>;