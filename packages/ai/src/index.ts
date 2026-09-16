import type { ChatMessage, ChatRequest, ChatResponse, IAIProvider } from './types.js';

interface ProviderCfg {
  id: string;
  key: string | undefined;
  defaultModel: string;
}

function stub(cfg: ProviderCfg): IAIProvider {
  const ensure = () => {
    if (!cfg.key) throw new AIProviderNotConfigured(cfg.id);
  };
  return {
    id: cfg.id,
    async chat(req: ChatRequest): Promise<ChatResponse> {
      ensure();
      // TODO: wire provider HTTP client (packages/ai) — stub answers deterministically.
      void req;
      return {
        content: `[${cfg.id}] stub response — real provider call not wired yet.`,
        usage: { inputTokens: 0, outputTokens: 0 },
        model: req.model ?? cfg.defaultModel,
      };
    },
  };
}

export type EnvLike = Record<string, string | undefined>;

/** Create a provider from env; matches Model Swap selection rules. */
export function createAIProvider(env: EnvLike = process.env): IAIProvider {
  const provider = (env.AI_PROVIDER ?? 'openai').toLowerCase();
  switch (provider) {
    case 'anthropic':
      return stub({ id: 'anthropic', key: env.ANTHROPIC_API_KEY, defaultModel: 'claude-3-5-sonnet-latest' });
    case 'gemini':
      return stub({ id: 'gemini', key: env.GEMINI_API_KEY, defaultModel: 'gemini-2.0-flash' });
    case 'openai':
    default:
      return stub({ id: 'openai', key: env.OPENAI_API_KEY, defaultModel: 'gpt-4.1-mini' });
  }
}

export type { ChatMessage, ChatRequest, ChatResponse, IAIProvider };
export { AIProviderNotConfigured } from './types.js';