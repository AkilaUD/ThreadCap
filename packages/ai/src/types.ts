/**
 * Model Swap abstraction (docs/01-architecture.md §6).
 * Providers are selected per call + per tier via AI_PROVIDER.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  content: string;
  usage?: { inputTokens: number; outputTokens: number };
  model: string;
}

export interface IAIProvider {
  readonly id: string;
  chat(req: ChatRequest): Promise<ChatResponse>;
  /** Optional embeddings support (retrieval pipeline). */
  embed?(texts: string[]): Promise<number[][]>;
}

export class AIProviderNotConfigured extends Error {
  constructor(providerId: string) {
    super(
      `AI provider "${providerId}" is not configured. Set AI_PROVIDER and the matching key ` +
        '(OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY). See docs/01-architecture.md §6.',
    );
    this.name = 'AIProviderNotConfigured';
  }
}