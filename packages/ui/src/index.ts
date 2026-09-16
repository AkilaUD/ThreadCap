/** Class-merge helper (placeholder until clsx/tailwind-merge are added). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export type { Section, SectionKind } from '@threadcap/shared-types';