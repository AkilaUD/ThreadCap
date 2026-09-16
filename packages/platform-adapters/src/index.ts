import type { InjectionMode, InjectionTargetName } from '@threadcap/shared-types';

/**
 * Platform adapter contract (docs/05-extension.md §4).
 * Detection targets the accessibility/text layer (D-014) and reads are
 * gesture-initiated only (D-018 zero-ingest captured as a flag).
 */
export interface PlatformAdapter {
  readonly target: InjectionTargetName;
  /** Capability matrix: which phases the adapter supports. */
  capabilities: {
    detect: boolean;
    getConversation: boolean;
    getComposer: boolean;
    inject: InjectionMode[];
    attachments: boolean;
    projectRefs: boolean;
    autoDrop: boolean;
    /** 0..1 confidence of text-layer detection */
    confidence: number;
  };
  detect(): Promise<boolean>;
  getConversation(): Promise<{ role: string; content: string }[]>;
  getComposer?(): Promise<{ text: string } | null>;
  inject(payload: string, mode: InjectionMode): Promise<void>;
}

export const platformOrder: InjectionTargetName[] = [
  'chatgpt',
  'claude',
  'gemini',
  'deepseek',
  'perplexity',
  'gmail',
  'paste-in',
];