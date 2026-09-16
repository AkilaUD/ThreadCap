# 01 — System Architecture

## 1. System context

ThreadCap is a **Context OS for AI**: one versioned context layer (Capsules) reachable from five delivery surfaces. The same Capsule is captured, stored, retrieved, injected, shared, and consumed by humans and AI agents identically across surfaces.

```
                    ┌──────────────────────────┐
                    │        WEB APP           │
                    │ library • search • teams │
                    │   capsule editor • Q&A   │
                    └───────────┬──────────────┘
                     capture/edit/inject ▲
                                        │ REST /v1 (JWT)
                    ┌───────────────────▼──────────────┐
                    │          THREADCAP API           │
                    │  Auth • Capsules • Versions      │
                    │  Capture • Search • Injections   │
                    │  Teams/Shares • Tokens • Billing │
                    └───────┬──────────────┬───────────┘
                            │              │
              JSON-RPC /mcp │              │ REST /v1
              X-API-Key     │              │ JWT
              ┌─────────────▼───┐   ┌──────▼─────────────┐
              │    MCP SERVER   │   │ CHROME EXTENSION   │
              │ cursor, VS Code │   │ capture/inject on  │
              │ agents, Copilot │   │ ChatGPT, Claude,   │
              └───────┬─────────┘   │ Gemini, Gmail, …   │
                      │             └──────┬─────────────┘
              ┌───────▼─────────┐          │
              │  CLAUDE SKILLS  │          │ SDK embed (personal chatbot)
              │ terminal (/cap*)│          ▼
              └─────────────────┘   ┌──────────────────┐
                                    │ SDK WIDGET       │
                                    │ in your web site │
                                    └──────────────────┘
```

## 2. Delivery surfaces

| # | Surface | MVP? | Primary actions |
|---|---|---|---|
| S-1 | **Chrome extension** (Manifest V3) | ✅ | Capture (raw/smart), inject (full/auto-drop), popup library, edit version inline, archive, Cook-This-Prompt enhancer, dynamic-context toggle |
| S-2 | **Web app** | ✅ | Library, capsule detail/editor, version history + diff + rollback, teams, shares, settings (tokens, E2EE, billing) |
| S-3 | **MCP server** | ✅ | `search_capsules`, `get_capsule`, `read_version`, `create_capsule`, `create_capsule_version`, `search_context` (+ skill counterparts) |
| S-4 | **Claude Code skills** | ✅ | `/capsule-login`, `/capsule-search`, `/capsule-read`, `/capsule-save`, `/capsule-version`, `/capsule-team` (thin CLI over same MCP tools) |
| S-5 | **SDK / personal chatbot** | ✅ (documented contract) | `boot`, `initButton`, `initDropZone`, `onExtract`, themeable widget library, drop callback |
| S-6 | **Landing page live demo** | ✅ | Guest "Try it now" builder (no account) that creates an anonymous demo capsule |
| S-7 | **Mobile app** | V3 | Library sync + capture from mobile AI apps (Roadmap) |

One shared backend: **every surface authenticates the same user and reads the same capsule**. Auth for S-1/S-2 = JWT; S-3/S-4 = `cht-*` API key; S-5/S-6 = anonymous read/demo scopes with no persistence; S-6 writes only to a sandboxed demo workspace.

## 3. Production deployment topology (free-first, Railway)

```
                    ┌───────────────────────── RAILWAY PROJECT (FREE) ─────────────────────────┐
Browser ─HTTPS─▶  [Railway static]  ──▶  apps/web (static, Vite build)
                                        apps/api  (NestJS, Docker/node)  ← REST /v1/* + /mcp/* (D-021)
                                        apps/skills (static files, one-click installer tarball)
                                        apps/lander (static, or GitHub Pages)
                                        ──────────────────────────────────────────────────────
                                        Volume  : /data/uploads  (0.5 GB free — LocalDiskProvider)
                                        Env     : secrets via Railway Variables (never in repo)
                    ┌─────────────────────────────────────────────────────────────────────────┐
                    │ Free external services (no Railway add-ons — the $1 credit cannot run them)│
                    │  • Neon (PostgreSQL 16 + pgvector, free, scale-to-zero)                  │
                    │  • Upstash (Redis, free: rate limits, BullMQ, sessions)                  │
                    │ GitHub public repo → unlimited Actions minutes + Pages (docs/lander)     │
                    │ External services: AI providers · Google OAuth · Email/SMTP · Stripe     │
                    └─────────────────────────────────────────────────────────────────────────┘
```

Rationale for the free-first stack (D-002/D-020/D-021):
- **Node.js-first** runtime — API + MCP share one service image on the free tier (D-021); no .NET toolchain in CI.
- **PostgreSQL + pgvector** and **Redis** live on **Neon** and **Upstash** free tiers (permanent, scale-to-zero) so Railway's $1 monthly credit is spent only on the Node service — Railway's paid add-ons (~$15–25/mo) would exhaust the free credit in days.
- **Volumes** provide durable uploads for MVP on the free tier (0.5 GB); the `StorageProvider` interface swaps to R2/S3 with env config, no code change.
- Background capture work uses Redis-backed queues (BullMQ) running **in-process** on the api service (`CAPTURE_WORKER_ENABLED`, concurrency capped) to respect Upstash's 500K commands/month.
- Full provisioning, env vars, monitoring, and the committed upgrade path: [11-deployment](/11-deployment.md).

## 4. Monorepo layout

```
threadcap/
├── apps/
│   ├── web/            # React 19 + Vite + Tailwind v4 + shadcn/ui (see 07-ux-screens)
│   ├── api/            # NestJS (Express) — REST /v1 + /mcp JSON-RPC + workers
│   ├── extension/      # CRXJS + Manifest V3 + React popup (see 05-extension)
│   ├── mcp/            # @modelcontextprotocol/sdk server (stdio + streamable HTTP)
│   ├── skills/         # Claude Code skills: SKILL.md + scripts + setup.sh
│   └── lander/         # marketing site + live demo + docs site (Astro)
├── packages/
│   ├── shared-types/   # zod schemas for every API/DTO (single source of truth)
│   ├── capsule-core/   # capsule model, versioning, diff, fingerprint, token estimation
│   ├── platform-adapters/ # chat/gmail/ide adapter contracts + implementations
│   ├── ui/             # shared React components (extension + web)
│   ├── sdk/            # @threadcap/capsule-hub browser SDK (widget, drop zone)
│   ├── ai/             # Model Swap provider abstraction + extraction/summarizer
│   └── storage/        # StorageProvider interface + local-disk + s3 impls
├── infrastructure/
│   ├── railway/        # service & add-on config, nixpacks/dockerfiles
│   └── db/             # migrations (node-pg-migrate), seeds
├── docs/               # this specification
└── tests/              # e2e (Playwright), load (k6), unit
```

> `apps/api` and `apps/mcp` stay separate packages in source but **deploy as one Railway service** on the free tier (D-021: REST `/v1/*` + JSON-RPC `/mcp/*` on the same origin + in-process capture worker). They are split back into separate services on the §10 upgrade trigger.

## 5. Core subsystem responsibilities

| Subsystem | Owns | Key components |
|---|---|---|
| **Identity & Tenancy** | Auth, org/team/project membership, RBAC | Access Token (15m JWT), rotating Refresh (30d), Google OAuth exchange, Argon2id, `cht-*` keys |
| **Capsule Engine** | Capsule lifecycle, versions, branches, merge/split, archive | `packages/capsule-core`; version store; content-hash; rollback |
| **Capture Pipeline** | Source → capsule with progress states | adapters (S-1), normalize, smart extraction (`packages/ai`), progress events, dedupe |
| **Retrieval** | Search, dynamic context, semantic Q&A (V2), CapsuleIndex graph | pgvector + FTS + Redis cache; RAG service |
| **Injection** | Prepare/inject payloads, fingerprint dedupe, token cost, stealth masking | `injections` service; platform adapters on extension side |
| **MCP/Skills** | JSON-RPC gateway, tool definitions, skills packaging | `apps/mcp`, `apps/skills` |
| **Billing** | Tiers, trial, upgrade/downgrade, meters | Stripe (Pro/Team), usage ledger table; plan gates in middleware |
| **Analytics** | Injection counts, capture counts, token savings, DAU | Usage events → Redis → nightly rollup (MVP: read-model tables) |

## 6. Model Swap (AI abstraction)

One interface (`packages/ai`), implementations selectable per call + per tier:

```ts
interface IAIProvider {
  complete(ctx: AiContext, opts: ModelOpts): Promise<AiResult>;
  embed(text: string): Promise<number[]>;
  flags: { supportsVision: boolean; supportsStreaming: boolean };
}
```
Providers: `OpenAIProvider`, `AnthropicProvider`, `GoogleProvider`, `MockProvider` (CI/tests).

Usage routing:
- Raw capture → **no AI** (fast path).
- Smart extraction → cheap tier by default (`gpt-4o-mini` class), escalate on complexity score.
- Summaries/embeddings → cheapest capable model, cached by `conversation_hash`.
- Token budget caps per user/tier enforced at this layer.

## 7. Key non-functional requirements

| NFR | Target |
|---|---|
| Capture (raw, 50 msgs) | p95 < 2 s; smart < 30 s with live progress |
| Injection prepare | p95 < 150 ms |
| Library list / search | p95 < 250 ms (Redis + indexed read model) |
| Search (first query after Neon idle) | warm p95 < 250 ms; post-scale-to-zero ~+300 ms–1 s cold-start accepted on free tier (D-020) |
| Uptime | **Best-effort on free tier** (no SLA, Neon scale-to-zero cold starts, 3-day logs); 99.9% target is the Hobby/Pro upgrade commitment ([11-deployment](/11-deployment.md) §10) |
| Security | OWASP ASVS L1+, secrets via Railway Variables only |
| Data residency | MVP single-region; Enterprise regional option (roadmap) |
| Observability | Request IDs, structured logs, OpenTelemetry traces, Sentry (free tier) |

## 8. Route map across this spec

- ERD & schema: [02-data-model](/02-data-model.md), [03-capsule-schema](/03-capsule-schema.md)
- Contracts: [04-api-contracts](/04-api-contracts.md), [openapi.yaml](/openapi.yaml), [06-mcp](/06-mcp.md)
- Client surfaces: [05-extension](/05-extension.md), [06-mcp](/06-mcp.md), [07-ux-screens](/07-ux-screens.md)
- Security: [08-security-model](/08-security-model.md)
- Gates: [09-mvp-acceptance](/09-mvp-acceptance.md), [10-roadmap](/10-roadmap.md)
- Operations: [11-deployment](/11-deployment.md)