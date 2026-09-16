import type { CaptureMessage } from '@threadcap/shared-types';
import { fnv1a64 } from './hash.js';

/**
 * Stable injection fingerprint (docs/05-extension.md §7, docs/04-api-contracts.md).
 * Built from sorted, normalized messages (volatile fields stripped).
 * Single-user offline dedupe: key = `${target}:${fingerprint}`.
 */
export function buildInjectionFingerprint({
  target,
  messages,
}: {
  target: string;
  messages: CaptureMessage[];
}): string {
  const normalized = messages.map((m) => ({
    r: m.role,
    c: m.content.replace(/\s+/g, ' ').trim(),
  }));
  const key = JSON.stringify({ t: target, m: normalized });
  return `f_${fnv1a64(key)}`;
}