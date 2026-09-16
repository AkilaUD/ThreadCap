import { describe, expect, it } from 'vitest';
import { buildInjectionFingerprint } from '../src/fingerprint.js';
import { estimateTokens, totalTokens, sectionTokens } from '../src/tokens.js';
import { contentHash, fnv1a64 } from '../src/hash.js';
import { diffSections, generateChangeSummary } from '../src/diff.js';
import { buildNextVersion } from '../src/version.js';
import type { Section } from '@threadcap/shared-types';

const baseSections: Section[] = [
  { id: 's1', kind: 'summary', name: 'Summary', content: 'ThreadCap project status' },
  { id: 's2', kind: 'decisions', name: 'Decisions', content: 'Free-first hosting (D-020)' },
];

describe('tokens', () => {
  it('estimates latin and CJK', () => {
    expect(estimateTokens('hello world foo bar')).toBe(5);
    expect(estimateTokens('你好，世界')).toBe(5);
  });
  it('totals sections', () => {
    expect(totalTokens(baseSections)).toBe(estimateTokens('ThreadCap project status') + estimateTokens('Free-first hosting (D-020)'));
    expect(Object.keys(sectionTokens(baseSections))).toEqual(['s1', 's2']);
  });
});

describe('hash', () => {
  it('fnv1a is stable', () => {
    expect(fnv1a64('abc')).toBe(fnv1a64('abc'));
    expect(fnv1a64('abc')).not.toBe(fnv1a64('abd'));
  });
  it('sha256 via web crypto', async () => {
    const a = await contentHash(baseSections);
    const b = await contentHash(baseSections);
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
});

describe('fingerprint', () => {
  it('stable and order-sensitive', () => {
    const m1 = [{ role: 'user' as const, content: '  hello   world ' }];
    const m2 = [{ role: 'user' as const, content: 'hello world' }];
    const m3 = [{ role: 'user' as const, content: 'world hello' }];
    expect(buildInjectionFingerprint({ target: 'chatgpt', messages: m1 })).toBe(
      buildInjectionFingerprint({ target: 'chatgpt', messages: m2 }),
    );
    expect(buildInjectionFingerprint({ target: 'chatgpt', messages: m2 })).not.toBe(
      buildInjectionFingerprint({ target: 'chatgpt', messages: m3 }),
    );
  });
});

describe('diff/version', () => {
  it('produces a change summary', () => {
    const changes = diffSections(baseSections, [
      { id: 's1', kind: 'summary', name: 'Summary', content: 'Changed' },
      { id: 's3', kind: 'next', name: 'Next', content: 'Ship it' },
    ]);
    const status = changes.map((c) => c.op);
    expect(status).toContain('modified');
    expect(status).toContain('added');
    expect(status).toContain('removed');
    expect(generateChangeSummary(changes)).toMatch(/modified/);
  });
  it('builds next version with hash', async () => {
    const v = await buildNextVersion({
      capsuleId: 'cap_test',
      versionNumber: 2,
      parentId: 'ver_test',
      prevSections: baseSections,
      nextSections: baseSections,
    });
    expect(v.versionNumber).toBe(2);
    expect(v.contentHash).toHaveLength(64);
    expect(v.changeSummary).toBe('No changes');
  });
});