# ThreadCap — Implementation Specification

**Status:** Draft v1.0 (2026-09-16)
**Owner:** ThreadCap Engineering
**Companion research:** Capsule Hub by Tilantra — deep feature analysis + full site study (2026-09-16) and 39-part product architecture proposal.

ThreadCap is a **Context OS for AI** — a versioned, portable, context-management layer that works across AI tools (ChatGPT, Claude, Gemini, Copilot, DeepSeek, Perplexity, Gmail, IDEs via MCP, the terminal via Claude Code skills, and any website via an embeddable SDK/skill). The core unit is a **Capsule**: a structured, versioned context package (goals, requirements, decisions, constraints, attachments, conversation) that moves between tools so you never re-explain your work.

This directory is the **formal implementation specification**. Everything required to build the MVP is specified here before any code is written. Later-phase features are specified as stubs with acceptance-level goals (see [10-roadmap](/10-roadmap.md)).

---

## 1. Document map

| File | Scope |
|---|---|
| [01-architecture.md](/01-architecture.md) | System context, delivery surfaces, Railway deployment topology, monorepo layout, technology decisions |
| [02-data-model.md](/02-data-model.md) | ERD (Mermaid), table-by-table schema, indexes, pgvector, multi-tenancy, retention, migration strategy |
| [03-capsule-schema.md](/03-capsule-schema.md) | Capsule JSON Schema (draft 2020-12), message format, versioning, E2EE envelope variant, worked examples |
| [04-api-contracts.md](/04-api-contracts.md) | REST `/v1` endpoint contracts + [openapi.yaml](/openapi.yaml); request/response JSON, errors, pagination, rate limits |
| [05-extension.md](/05-extension.md) | Chrome Manifest V3 architecture, platform adapters, capture pipeline + progress, injection (auto-drop), dedupe, edit/rollback UX, stealth injection |
| [06-mcp.md](/06-mcp.md) | MCP server (JSON-RPC over HTTPS), `cht-*` token lifecycle, tool inventory, Claude Code skills mapping |
| [07-ux-screens.md](/07-ux-screens.md) | Screen-by-screen UX with wireframes: web app, extension popup, inject preview, capture progress, settings, landing demo |
| [08-security-model.md](/08-security-model.md) | Auth, RBAC, tenant isolation, E2EE optional tier, stealth injection, dynamic-context toggle, retention, threat model |
| [09-mvp-acceptance.md](/09-mvp-acceptance.md) | Gherkin acceptance criteria, definition-of-done, E2E test plan, performance budgets, release gates |
| [10-roadmap.md](/10-roadmap.md) | Phase map: MVP → V2 → V3 → Enterprise; competitor-announced items positioned for differentiation |
| [11-deployment.md](/11-deployment.md) | Deployment guide: free-first hosting (Railway Free + GitHub public + Neon + Upstash), CI/CD, env vars, DNS, monitoring, backups, upgrade path |

---

## 2. Decisions (ADRs)

| # | Decision |
|---|---|
| D-001 | Product name **ThreadCap**; core unit is a **Capsule** (portable, versioned context package). |
| D-002 | **Hosting free-first, matched to Railway**: Node.js-first services (no .NET), static web build. App services (web, api+mcp, skills, lander) run on **Railway Free**; PostgreSQL 16 + pgvector on **Neon free**; Redis on **Upstash free**; attachments on the Railway volume via local-disk provider (R2/S3 later). GitHub repository is **public** → unlimited free Actions. Committed upgrade path documented in [11-deployment](/11-deployment.md) §10. |
| D-003 | **Monorepo** (pnpm workspaces + Turborepo) with `apps/` (web, api, extension, mcp, skills) and `packages/` (shared-types, capsule-core, platform-adapters, ui, sdk, ai, storage). |
| D-004 | Capule content is **structured sections, not one JSON blob**, so retrieval can operate at section/chunk level. |
| D-005 | Versions are **immutable snapshots** with parent lineage (Git-like). Editing always creates a new version; rollback creates a new version equal to an ancestor. |
| D-006 | **Differentiated pricing** (see ADR D-007 section in [10-roadmap](/10-roadmap.md)): Free = 25 active capsules + unlimited archive; Pro = $5/mo; Team = $10/user/mo; Enterprise custom. Do NOT mirror Capsule Hub's 5-free-capsule model. |
| D-007 | **E2EE is an optional enterprise feature** (ADR in [08-security-model](/08-security-model.md)) — the default is a Trusted Custodian model because the AI/retrieval layer must read context (RAG). |
| D-008 | All external surfaces share **one auth model** (JWT web/extension; `cht-*` API keys for MCP/skills) so a capsule is readable from any surface with the same permissions. |
| D-009 | Injection is **deterministic and isolated**: a neutral context preamble injected into the composer with an explicit token-cost footer and a per-injection fingerprint to prevent duplicates. |
| D-010 | Capture is a **processed pipeline with progress states** (parse → extract → summarize → save), never a blocking "loading forever" operation. |
| D-011 | **Con-defeating product posture** (see §6.2): every known Capsule-Hub-class weakness gets an explicit countermeasure in design from day one — token-first injection, context-rot-proof live capsules, selector-free adapters with a universal paste-in fallback, zero-ingest enterprise capture, and one-command agent tooling. |
| D-012 | **Purpose-driven briefs over total recall** (§ in [05-extension](/05-extension.md) §6.4): injection never dumps the whole capture by default. User picks a *purpose* + explicit token budget; the server renders the smallest section-set that serves it (recap, handoff, review, build). Deepen-on-demand adds missing sections as follow-up injections instead of one mega-paste. |
| D-013 | **Live capsules** ([05-extension](/05-extension.md) §9, V1-lite consent flow): a capsule pinned to a project ref can be **auto re-harvested on chat close** into a new version (never a silent mutation), with a drift diff since last capture. Addresses "context rot / manual recapture". Off unless user enables **Keep this capsule updated**. |
| D-014 | **Selector-free adapters** ([05-extension](/05-extension.md) §4.1): capture reads the **accessibility/text layer**, not CSS class guesses; selector packs are **remote-config-driven** (edge config) so a hugging DOM change is hot-fixed without an extension release; every platform also gets a **universal paste-in fallback** (paste transcript → capsule) that works even when detection breaks or on mobile. |
| D-015 | **Zero-ingest capture mode** ([08-security-model](/08-security-model.md) §9.5): enterprise/user toggle that **disables page reading entirely** — capture works from clipboard paste, file import, SDK event, or `/threadcap capture`-style API call; a client-side PII scrubber redacts before upload. |
| D-016 | **One-command agent setup** ([06-mcp](/06-mcp.md) §8): `threadcap setup` installs Claude Code skills, writes MCP client config, and verifies auth in a single run; no multi-step terminal archaeology. |
| D-017 | **Attach-as-file mode** ([05-extension](/05-extension.md) §6.4): where the host platform supports reference files (ChatGPT attachments, Claude docs, Gemini files), inject as a **file/reference** (native-project-like) instead of inline prompt text, with a front-loaded brevity block. Direct countermeasure to the "external prompt tax" and "lost in the middle". |
| D-018 | **Inert-until-gesture scripting posture** ([05-extension](/05-extension.md) §11.1): content scripts are inert until the user clicks Capture/Inject; no always-on DOM observers, no polling, no main-world injection; content never touches the network. Reduces ad-blocker/Brave flagging (C-11) and kills the "always reading my screen" perception (C-12). |
| D-019 | **Zero-player capture hygiene** ([05-extension](/05-extension.md) §5.1): every capture gets auto-name (from transcript title/summary), auto-tag (detected project/folder), and a related-capsule suggestion ("this looks like Ecoru v7 — update it") to stop session bloat before it starts. |
| D-020 | **Free-first hosting commitment** ([11-deployment](/11-deployment.md)): the MVP ships on a $0 stack — GitHub public repo (unlimited Actions, Pages), Railway Free for app services only, Neon free Postgres (+pgvector), Upstash free Redis, Railway volume for attachments. The upgrade path (Hobby/Pro/Launch) is a committed trigger-based decision, not deferred tech-debt: move off free when the §10 triggers fire (credit exhaustion, Neon/Upstash limits, >1 replica, scale gate), never before — and never silently. NFRs on free tier are best-effort (no SLA, Neon cold starts, 3-day logs). |
| D-021 | **Merged api+mcp service on the free tier** ([11-deployment](/11-deployment.md) §1/§3): one Node service serves `REST /v1/*` + MCP JSON-RPC `/mcp/*` + the in-process BullMQ capture worker, because Railway Free is limited to 1 replica per service and each Node service eats the $1 credit. Split into separate `apps/api` / `apps/mcp` / worker services when the free-step upgrade trigger fires (§10) or the two surfaces' scaling profiles diverge. |

---

## 3. Conventions (canonical, apply everywhere)

### 3.1 Identifier formats
| Entity | Prefix | Example |
|---|---|---|
| User | `usr_` | `usr_01HZXV1PY2...` |
| Organization/workspace | `ws_` | `ws_01HZX...` |
| Team | `tm_` | `tm_01HZX...` |
| Project | `prj_` | `prj_01HZX...` |
| Capsule | `cap_` | `cap_01HZX...` |
| Version | `ver_` | `ver_01HZX...` |
| Attachment | `att_` | `att_01HZX...` |
| Capture session | `csv_` | `csv_01HZX...` |
| Injection | `inje_` | `inje_01HZX...` |
| Share link | `shr_` | `shr_01HZX...` |
| MCP API token | `cht_` | `cht_<50x base62>` |
| Request ID (logs/errors) | `req_` | `req_01HZX...` |

IDs are **ULIDs** (128-bit, sortable) exposed as base32 of the canonical prefix + ULID payload. All IDs are server-generated.

### 3.2 Time & pagination
- All timestamps are **ISO 8601 UTC** (`2026-09-16T09:30:00.000Z`).
- List endpoints use **cursor pagination**: `?limit=20&cursor=<opaque>`, response meta: `{ "nextCursor": "…" | null, "total": n }`.
- `limit` clamp: `1..100` (default 20). Invalid cursor → `400`.

### 3.3 Error envelope (all HTTP errors)
```json
{
  "requestId": "req_01HZX...",
  "error": {
    "code": "CAPSULE_NOT_FOUND",
    "message": "Capsule cap_01HZX... does not exist or you do not have access.",
    "details": null
  }
}
```
- `code` uses `SCREAMING_SNAKE_CASE` and is stable across versions (clients must switch on `code`, not `message`).
- Common codes: `VALIDATION_ERROR` (422), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `RATE_LIMITED` (429), `CONFLICT` (409), `TRIAL_EXPIRED` (402), `TOO_MANY_ACTIVE` (409), `INTERNAL` (500).
- Errors include `Retry-After` header for 429.

### 3.4 Auth headers
- Web app / extension REST: `Authorization: Bearer <jwt>` (access token, 15 min, rotated refresh 30 days).
- MCP + Claude skills + background jobs: `X-API-Key: cht_…` (long-lived, scoped, revocable; see [06-mcp](/06-mcp.md)).
- Google OAuth JWT from `credential` served as an exchange grant only.

### 3.5 Routing & versioning
- All public REST under `/v1/*`; OpenAPI at [openapi.yaml](/openapi.yaml).
- MCP JSON-RPC endpoint: `POST /mcp/` (projection of the same service; see [06-mcp](/06-mcp.md)).
- Extension content-script RPC uses `chrome.runtime.sendMessage` with typed envelopes (`TC_*`), documented in [05-extension](/05-extension.md).

### 3.6 Content & language
- English only for MVP strings; i18n-ready (all user-facing strings externalized, ICU message format).
- Money/values displayed in USD; plans separated from currency concerns.

---

## 4. Glossary

| Term | Definition |
|---|---|
| **Capsule** | Versioned, structured context package (identity + context sections + conversation + resources + metadata + history). |
| **Version** | Immutable snapshot of capsule content with parent/branch lineage, author, timestamp, change summary, content hash. |
| **Branch** | Diverged lineage of a capsule (e.g., engineering vs product vs QA). Merge = combine capsule contexts with dedupe. |
| **Capture** | Turn a source (AI conversation, Gmail thread, terminal save, web form) into a capsule. Two modes: raw and smart (AI-extracted structured sections). |
| **Injection** | Place capsule context into a target composer (chat input, IDE, MCP call). Modes: `full` / `smart` / `summary` / `custom`. |
| **Auto-Drop** | Passive injection: when a chat opens with a recently-pinned capsule present, prompt once to inject; one click, no drag. |
| **Injection fingerprint** | SHA-256 of the normalized payload + target + capsule version; blocks duplicate injections into the same conversation. |
| **Dynamic context** | AI semantic filtering: only the capsule sections relevant to the current exchange are injected (paid feature). Guarded by a per-user toggle. |
| **Smart extraction** | LLM pass that converts raw conversation into structured sections (objective, requirements, decisions, constraints, open questions, summary). |
| **Stealth injection / privacy masking** | Injection path that avoids leaving detectable platform markers and strips source metadata the host platform could fingerprint. |
| **CapsuleIndex** | Graph-based retrieval layer (capsules, requirements, decisions ↔ files, bugs, conversations) used by search, dynamic context, and semantic Q&A. |
| **Semantic Q&A** | Chat-with-your-capsules: natural-language query answered over the authorized capsule corpus (V2). |
| **Context Replay** | Traceability: reconstruct "what did we know when decision D-43 was made", which capsule version produced a given answer (V2). |
| **Model Swap** | Provider-agnostic AI abstraction (OpenAI / Anthropic / Gemini / local) behind one `IAIProvider` interface. |
| **ch-token** | Scoped API key (`cht_…`) for MCP clients and Claude Code skills. |
| **Archived capsule** | Hidden from active lists but retained forever (unlimited on all tiers) — archive-not-delete. |
| **Golden prompt / team context** | Team-maintained evolving master context ("the perfect prompt") surfaced as a pinned team capsule. |

---

## 5. Tier matrix (D-006, differentiated)

| Capability | Free | Pro $5/mo | Team $10/user/mo | Enterprise |
|---|---|---|---|---|
| Active capsules | 25 | Unlimited | Unlimited | Unlimited |
| Archived capsules | Unlimited | Unlimited | Unlimited | Unlimited |
| Capture (raw + smart) | Yes | Yes | Yes | Yes |
| Injection (all modes) | Full/Summary | Full/Smart/Summary/Custom | + Auto-Drop | + programmatic |
| Attachments | 5 (20 MB total) | All 20+ types (2 GB total) | All types (10 GB/user) | Custom |
| Version history | 5 per capsule | Deep (100) | Full version tree | Full + legal lock |
| Teams | — | Join 1 | Create/admin, RBAC, audit | Custom + SCIM |
| MCP / API tokens | — | 3 tokens | 10 tokens | Unlimited, scoped |
| Dynamic context / CapsuleIndex search | Keyword | Keyword + semantic | + Q&A | + Context Replay |
| Shared read-only links | — | Yes | Yes | Yes + expiry controls |
| E2EE (client-side) | — | — | — | Yes (opt-in) |
| Support | Community | Priority | Priority | SLA, private deploy |

Trial: 14-day Pro trial, then Free (no card). Free users hit `TOO_MANY_ACTIVE` **only after 25**; they archive instead of delete.

---

## 6. Sources studied (2026-09-16)

- Capsule Hub marketing site — all public pages: `/`, `/login`, `/register`, `/forgot-password`, `/contact`, `/docs` (+ getting-started, use-cases, features, mcp, personal-chatbot, anthropic-skills, plans, platforms, troubleshooting, privacy).
- Chrome Web Store listing (v2.16) + full review corpus.
- `@tilantra/capsule-hub` SDK (npm v2.0.2, README + esm.sh build) and personal-chatbot integration docs.
- `Tilantra/capsule-hub-skills` GitHub repo (6 Claude Code skills) — real MCP tool shapes (`create_capsule`, `search_capsules`) and backend conventions.
- `backend.tilantra.com` probe ("Model Swap Router API"), privacy policy, LinkedIin launch post, ExtScope/Uneed third-party listings.

This spec deliberately **matches their documented behavior where useful and diverges where weak** (pricing, edit flow, injection reliability, capture progress, E2EE, semantic Q&A, auto-drop). Divergences are justified in [10-roadmap](/10-roadmap.md).

### 6.2 Con-countermeasure map (D-011)

Classified weaknesses of prompt-layer context tools and the ThreadCap design response (granular, developer-context pass 2026-09-18):

| # | Competitor weakness (from third-party critiques + reviews) | ThreadCap countermeasure | Where |
|---|---|---|---|
| C-1 | **Token burn on inject**: drag-in dumps a large block, starving the context window | Purpose-driven briefs + explicit token budget + deepen-on-demand (D-012) | [05](/05-extension.md) §6.4, [03](/03-capsule-schema.md) §7 |
| C-2 | **External prompt tax**: every new user message re-reads the whole injected history | Budget-bounded briefs + attach-as-file mode so the block is only a reference, not per-message prompt text (D-012/D-017) | [05](/05-extension.md) §6.4, [07](/07-ux-screens.md) §7 |
| C-3 | **Diluted attention / "lost in the middle"**: dense flat block buries your new instructions | Front-loaded importance ordering, flat single-depth sections, brevity-block-first; attach-as-file gives native project-like segmentation (D-017) | [05](/05-extension.md) §6.2, §6.4 |
| C-4 | **Static snapshot / no auto-sync → context rot** | Live capsules (consented auto re-harvest → vN+1 + drift diff) (D-013) | [05](/05-extension.md) §8.1, [09](/09-mvp-acceptance.md) H-REQ-13 |
| C-5 | **Session bloat**: capsule-per-hour from LLM hopping; finding "the exact version" is a manual chore | Auto-name + auto-tag + related-capsule suggestion on capture (D-019); near-dup detection & supersede in Phase 2; full-text + semantic search over metadata/versions | [05](/05-extension.md) §5.1, [10](/10-roadmap.md) Phase 2 |
| C-6 | **Desktop-only workflow** | PWA read-only + quick capture; paste-in fallback anywhere; share links | [10](/10-roadmap.md) Phase 3 |
| C-7 | **SDK requires custom `onExtract`/`initDropZone`** to read app state | Auto-extractor presets + headerless default extractor + `captureFrom({messages})` zero-config path; `onExtract` stays optional | [10](/10-roadmap.md) Phase 2 |
| C-8 | **Terminal auth overhead**: shell-stored JWTs expire mid-task → re-`/capsule-login` | Keychain-stored refresh sessions with silent rotation; device-bridge login; one-keypress re-auth rescue; key-mode alt (D-016) | [06](/06-mcp.md) §7 |
| C-9 | **UI redesign breaks scraper until emergency patch** | Selector-free text-layer capture + remote selector packs + universal paste-in fallback (D-014) | [05](/05-extension.md) §4.1, [09](/09-mvp-acceptance.md) H-REQ-11 |
| C-10 | **MCP/CLI setup friction** for non-technical users | One-command `threadcap setup` + `/.well-known/mcp.json` discovery (D-016) | [06](/06-mcp.md) §8 |
| C-11 | **Ad-blocker / script-manager / Brave shield flags** content-script comms on chat pages | Inert-until-gesture scripting, no main-world injection, background-only fetch, on-demand `executeScript`, declarativeNetRequest instead of broad `host_permissions` (D-018) | [05](/05-extension.md) §11.1 |
| C-12 | **"Always reading my screen" perception → enterprise IT bans page-reading extensions** | Zero-ingest mode (no DOM read at all) + read-on-gesture-only posture + explicit permission disclosure UI + PII scrubber + admin allow-list policy (D-015/D-018) | [08](/08-security-model.md) §9.5 |
| C-13 | **DOM-scraping compliance roadblocks** for firms handling client/financial data | Zero-ingest enterprise policy: capture-from-paste/file/SDK/API, forced scrub, audit of capture source per event | [08](/08-security-model.md) §9.5, [10](/10-roadmap.md) Phase 4 |