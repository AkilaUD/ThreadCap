import { z } from 'zod';
import { InjectionIdSchema } from './ids.js';

/** Host platforms the extension can inject into (docs/05-extension.md §4.2). */
export const InjectionTargetName = z.enum([
  'chatgpt',
  'claude',
  'gemini',
  'deepseek',
  'perplexity',
  'gmail',
  'paste-in',
]);
export type InjectionTargetName = z.infer<typeof InjectionTargetName>;

export const InjectionMode = z.enum(['inline', 'attach', 'paste']);
export type InjectionMode = z.infer<typeof InjectionMode>;

export const PreparedInjection = z.object({
  id: InjectionIdSchema,
  capsuleId: z.string(),
  versionNumber: z.number().int().positive(),
  target: InjectionTargetName,
  mode: InjectionMode,
  tokenCount: z.number().int().nonnegative(),
  budgetTokens: z.number().int().nonnegative(),
  overBudget: z.boolean().default(false),
  fingerprint: z.string(),
  sections: z.array(z.string()).default([]),
});
export type PreparedInjection = z.infer<typeof PreparedInjection>;

/** Result shape when prepare exceeds the budget (docs/04-api-contracts.md /injections/prepare). */
export const BudgetExceededResult = z.object({
  mode: z.literal('budgetExceeded'),
  tokenCount: z.number().int().nonnegative(),
  budgetTokens: z.number().int().nonnegative(),
  attachAsFileAvailable: z.boolean().default(false),
  reasons: z.array(z.string()).default([]),
});
export type BudgetExceededResult = z.infer<typeof BudgetExceededResult>;