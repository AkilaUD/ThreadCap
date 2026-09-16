import type { Section, SectionChange, SectionRef } from '@threadcap/shared-types';

/**
 * Section-level diff between two version snapshots.
 * Returns a list of SectionChange descriptors for version history / drift display.
 */
export function diffSections(
  prev: readonly Section[],
  next: readonly Section[],
): SectionChange[] {
  const prevMap = new Map(prev.map((s) => [s.id, s]));
  const nextMap = new Map(next.map((s) => [s.id, s]));
  const allIds = new Set([...prevMap.keys(), ...nextMap.keys()]);
  const changes: SectionChange[] = [];

  for (const id of allIds) {
    const was = prevMap.get(id);
    const now = nextMap.get(id);
    const ref: SectionRef = {
      id,
      kind: (now ?? was!)!.kind,
      name: (now ?? was!)!.name,
    };
    if (!was) {
      changes.push({ op: 'added', ref, now });
    } else if (!now) {
      changes.push({ op: 'removed', ref, was });
    } else if (was.content !== now.content || was.name !== now.name) {
      changes.push({ op: 'modified', ref, was, now });
    } else {
      changes.push({ op: 'unchanged', ref, was, now });
    }
  }
  return changes;
}

/** Generate a concise change summary string from a diff. */
export function generateChangeSummary(changes: SectionChange[]): string {
  const counts = { added: 0, removed: 0, modified: 0 };
  for (const c of changes) {
    if (c.op !== 'unchanged') counts[c.op]++;
  }
  const parts: string[] = [];
  if (counts.added) parts.push(`${counts.added} added`);
  if (counts.removed) parts.push(`${counts.removed} removed`);
  if (counts.modified) parts.push(`${counts.modified} modified`);
  return parts.length ? `Sections ${parts.join(', ')}` : 'No changes';
}