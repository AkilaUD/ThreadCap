import type { Section } from '@threadcap/shared-types';

/**
 * Canonical content hash over a section set.
 * Uses Web Crypto (crypto.subtle) — runs in Node 19+ and browsers.
 * See: docs/03-capsule-schema.md §7 content hash.
 */
export async function contentHash(sections: readonly Section[]): Promise<string> {
  const canonical = JSON.stringify(
    sections.map((s) => ({ id: s.id, kind: s.kind, name: s.name, content: s.content })),
  );
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Synchronous fallback hash (FNV-1a 64-bit, truncated to 16 hex chars). Use only for testing. */
export function fnv1a64(input: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i) & 0xff);
    h = (h * prime) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0');
}