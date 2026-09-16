import type { Section, CaptureMessage } from '@threadcap/shared-types';

/**
 * Heuristic token estimator: 1 token ≈ 4 latin chars; CJK codepoints ≈ 1 token each.
 * Real-world ILF averages ~0.75 tokens/word but 4 chars/token is a pragmatic ceiling.
 */
const CJK_RANGES =
  /[\u2E80-\u2EFF\u2F00-\u2FDF\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u3200-\u32FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\u{20000}-\u{2A6DF}\u{2A700}-\u{2B73F}\u{2B740}-\u{2B81F}\u{2B820}-\u{2CEAF}\u{2CEB0}-\u{2EBEF}\u{30000}-\u{3134F}]/gu;

/** Estimate token count for a single text chunk. */
export function estimateTokens(text: string): number {
  const cjk = text.match(CJK_RANGES) ?? [];
  const latin = text.length - cjk.length;
  const latinTokens = Math.ceil(latin / 4);
  return latinTokens + cjk.length;
}

/** Approximate row/section token count. */
export function sectionTokens(sections: Section[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const s of sections) m[s.id] = estimateTokens(s.content);
  return m;
}

/** Sum of all section token counts. */
export function totalTokens(sections: Section[]): number {
  return sections.reduce((acc, s) => acc + estimateTokens(s.content), 0);
}

/** Approximate message token cost for a capture request (messages array). */
export function captureTokenCost(messages: CaptureMessage[]): number {
  return messages.reduce((acc, m) => acc + estimateTokens(m.content), 0);
}