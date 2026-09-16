export const EXT_NAME = 'threadcap';
export const EXT_VERSION = '0.0.0';

export const INERT_ON_LOAD = true;

export interface PopupState {
  mode: 'idle' | 'capturing' | 'injecting';
}

export function defaultState(): PopupState {
  return { mode: 'idle' };
}

export const supportedTargets = ['chatgpt', 'claude', 'gemini', 'deepseek', 'perplexity', 'gmail'] as const;