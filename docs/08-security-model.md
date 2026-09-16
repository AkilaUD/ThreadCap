# 08 — Security Model

## 1. Threat model (top risks)

| # | Threat | Mitigation |
|---|---|---|
| T-1 | Tenant crossover (user reads another org's capsule) | `workspace_id` from JWT only; every query joins membership (02 §4); RBAC checks per resource; Playwright E2E for cross-tenant attempts |
| T-2 | Stolen JWT replay | 15-min access + rotating 30-day refresh; `jti` revocation on logout; token-type claim (`access`/`refresh`); optional device binding (Enterprise) |
| T-3 | Leaked `cht_*` key | Store hash only, scoped, revocable, rate-limited; prefix for triage; `last_used_at` surfaced in UI; secret shown once |
| T-4 | Conversation content compromise at rest | App-layer AES-256-GCM for sensitive columns (messages, attachment text, vector chunks); key separation: DB encryption key vs storage key; Enterprise E2EE adds per-user DEK |
| T-5 | Injection into wrong conversation / duplicate | Composer session + fingerprint dedupe (05 §6.3); `409 INJECTION_DUPLICATE`; user confirm on reinject |
| T-6 | Host-platform prompt injection via capsule content | Capsule content is treated as **data**: isolated context preamble footer, no system directives, escaping of markdown/code fences; sanitization on render |
| T-7 | Rate-limit bypass | Redis sliding window per user/IP/token; auth stricter; retry-after + headers |
| T-8 | Mass account creation for trial abuse | Google OAuth preferred; per-email/IP caps; trial keyed by verified contact method; Stripe billing for paid tiers |
| T-9 | Attachment path traversal / object URL guessing | Opaque storage keys (never user-controlled path), presigned URLs 15 min read / 30 min write, signed by server secret; MIME allow-list |
| T-10 | Admin/team escalation | Role checks server-side (`owner>admin>editor>contributor>viewer`); mutation endpoints enforce plan+role; audit log every role change |

## 2. Identity & sessions
- **Passwords**: Argon2id (m=64 MiB, t=3, p=1), never logged. Minimum 12 chars; zxcvbn strength acceptance.
- **Google OAuth**: `credential` id_token exchanged at `POST /v1/auth/google`; `google_sub` unique; email verified by issuer. Google OAuth used **only** for authentication (no Gmail/Drive scopes — privacy parity with competitors' promises, see §9).
- **JWT claims**: `{ sub, ws, role_map, type: 'access'|'refresh', jti, iat, exp }`. Access 15 min; refresh 30 days, rotated on use, families tracked for replay detection (revoke family on anomaly).
- **Refresh storage**: mobile/extension = encrypted in `chrome.storage.local`; web = httpOnly cookie option out of MVP (bearer in memory only).

## 3. Authorization & RBAC

Roles (workspace/team):
```
OWNER > ADMIN > EDITOR > CONTRIBUTOR > VIEWER
```
Operations matrix (excerpt):
| Action | owner | admin | editor | contributor | viewer |
|---|---|---|---|---|---|
| View capsule | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create/Edit version (own) | ✓ | ✓ | ✓ | ✓ | — |
| Edit team capsule | ✓ | ✓ | ✓ | — | — |
| Archive/Delete capsule | ✓ | ✓ | ✓ | — | — |
| Manage members / golden prompt | ✓ | ✓ | — | — | — |
| API tokens | ✓ | ✓ (own) | — | — | — |

Rules:
- `workspace_id` and `team_id` come from the **auth context**, never request bodies. Any body attempt → `400 INVALID_TENANT_FIELD`.
- Share links bypass RBAC **by design** for `read_only`; conversation omitted by default (see §7).
- Plan gates (free 25, attachments limits, MCP tokens) enforced in middleware reading `users.plan` + `trial_ends_at` (Redis-cached).

## 4. API security
- TLS everywhere (edge). Strict HSTS, CSP on web.
- Headers: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`.
- CORS allow-list (`app.threadcap.app`, extension `chrome-extension://…` — extension uses capability-based headers, not CORS).
- Rate limits per [04-api-contracts](/04-api-contracts.md) §12. `X-Request-Id` echoed; correlation in logs.
- Webhooks/V2 endpoints get signature verification (`X-Threadcap-Signature = HMAC-SHA256(secret, body)`).

## 5. Data encryption at rest (default: Trusted Custodian)
- Columns encrypted app-layer before DB write: `users.email` (search uses citext shadow), `capsule_messages.content`, `attachments.meta_json.text`, `embedding_chunks.ciphertext`.
- Algorithm: AES-256-GCM; key id in envelope (`kid + iv + tag`); per-tenant key material versioned.
- Key handling: master key in Railway env/**Vault/KMS** (Enterprise), keys rotated on rotation policy; DB encryption key ≠ storage signing key ≠ JWT secret.
- Semantic summaries are **non-verbatim** (no raw conversation echoes) so retrieval can index summaries safely.
- Storage blobs encrypted with a separate key, written via `StorageProvider` (02 §7).

## 6. E2EE optional tier (Enterprise, D-007)

Two modes behind `users.e2ee_enabled`:

| Mode | Who can decrypt | Retrieval |
|---|---|---|
| **Server-assisted (default Enterprise)** | Server unwraps DEK per-request (Trusted Custodian) | RAG works; printer sealed by policy; audit every unwrap |
| **Client-only (privacy maximal)** | Only client keys (never sent) | Retrieval degrades to tag/search over plaintext sidecar summaries; dynamic context marked degraded |

Envelope (saved with each section/message):
```
{ "v":1, "alg":"AES-256-GCM", "iv":…, "tag":…, "ct": base64,
  "dek": { "wrappedBy":"rsa-oaep-3072","kid":"usr_x:2026-09-16","wrapped":… } }
```
Wizard under Settings → Security: generate DEK + KEK, print recovery code, choose mode. Enabling E2EE migrates affected capsules (background job), blocking capture while migrating that capsule.

## 7. Attachments & storage
- Signed uploads: `POST /attachments/presign` → 30-min write URL; reads 15-min.
- Private blobs are never public; object URLs require signature; server verifies `contentHash` on register.
- MIME allow-list: pdf, md/txt/code (by extension + magic bytes), png/jpeg/webp, docx/pptx/xlsx (Enterprise), sql/csv.
- Size caps by tier (Free 20 MB total attachments, single ≤ 25 MB; Pro 2 GB; Team 10 GB/user).

## 8. Stealth injection & privacy masking
- `prefs.stealthInjection` default **on**: injected block omits capturer identity, tool IDs, and screenshot-exposed metadata; IDs in footer shortened.
- No tracking pixel or beacon in injected content; no DOM signals to host beyond the composer write.
- Host-platform terms apply (injecting is a user-initiated action inside the target product); UI labels state "content you inject becomes subject to the host platform's policy."

## 9. Dynamic-context toggle & compliance (parity + control)
- `prefs.dynamicContext` (default **off** for Free, on for Team+). When on, the extension may send live prompts for semantic filtering **only on the current chat**; never browsing other sites; toggle is a first-class control (popup + Settings).
- Privacy policy contract enforced in code: no search-history tracking, no off-platform content capture, no model training, no ads profiling, no cross-user exposure.
- Data classification mirrors [Capsule Hub privacy] behavior but with stronger defaults: continuous capture **off** unless explicitly enabled per chat.

### 9.5 Zero-ingest capture mode (D-015, countermeasure C-9)
For enterprises that block extensions which read page DOM, and for policy-sensitive users:

- `prefs.zeroIngest` (Settings → Preferences; admin-managed for Enterprise workspaces): **disables all page reading**. The content script never queries `innerText`, `aria-*`, or DOM structure on chat pages.
- Capture still works via **non-scraping sources**: clipboard paste (the universal fallback, [05-extension](/05-extension.md) §4.1), file import (.md/.txt/.json), SDK event (`captureFrom({ messages })`), or `/threadcap capture` API — each produces the same pipeline/capsule shape with `captureMode` recorded in `source`.
- **Client-side PII scrubber** runs before upload in this mode (and is a toggle everywhere): regex + NER redact emails, phone numbers, keys/tokens, client names per a removable pattern list; scrub report shown to user ("3 items redacted").
- Extension permission footprint in this mode drops to `storage` + `alarms` only (no `host_permissions` for reading). The web app remains fully functional for a zero-ingest-only org.
- **Enterprise allow-list policy** (workspace `prefs`): force `zeroIngest: true`, pin scrub patterns, block unknown host reads, and log every capture's source (`paste|sdk|file|api`) in audit. Satisfies the "flag third-party extensions that ingest page data" block without losing the capture workflow.

## 10. Retention & deletion
| Data | Retention |
|---|---|
| Capsules/versions (deleted) | Purging after 30 days |
| Account-deletion owned rows | Permanent within 30 days; tokens revoked immediately |
| Usage/audit logs | 90 days |
| Refresh sessions | Revoked at logout/rotation |
| Demo workspace (landing demo) | Purged 24 h |

`DELETE /capsules/:id` = soft (can Restore within window via Support). Hard purge is worker-driven (nightly, batched).

## 11. Auditing
- `audit_logs` (02 §3.16): action, actor, resource, ip (masked), meta. Written for: capsule create/edit/delete/rollback/archive, version create, share create/revoke, token issue/revoke, team changes, plan changes, E2EE enable.
- MCP calls logged with clientId + tool + args-hash (args never logged verbatim for sensitive text — metadata only).
- API access logs: requestId, route, status, latency; payloads redacted.

## 12. Secrets & environments
- All secrets via **Railway Variables** (Neon DB URL + password, `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`, S3 keys, JWT secrets, Google OAuth, Stripe, AI provider keys, master encryption key, HMAC secrets for webhooks). Never in repo; `.env.example` has placeholders only. (Full env list: [11-deployment](/11-deployment.md) §3.)
- CI uses a sandboxed env; SSRF protection on `import-share` (only allow-list host prefixes: chatgpt.com, gemini.google.com, claude.ai, chat.deepseek.com, plus own share domain).
- Dependency scanning (npm audit, Renovate), SAST in CI, and `npm audit` gate at release.

## 13. Security acceptance (excerpt — full in [09-mvp-acceptance](/09-mvp-acceptance.md) §6)
- SEC-1 Cross-tenant read of capsule → 404 (not 403 leak of existence).
- SEC-2 Revoked `cht_*` token rejected within 1 s (cache TTL).
- SEC-3 Capture payload size/message-count caps enforced (422).
- SEC-4 E2EE client-only mode: server cannot recover content (integration test decrypt-only-client-key).
- SEC-5 Dynamic-context toggle off → zero prompt egress on non-chat pages (network-level E2E assertion).
- SEC-6 Zero-ingest mode: E2E asserts **no DOM reads** on chat pages (content script's `host_permissions` runtime-dropped; capture via paste only proves `captureMode: "paste"`).
- SEC-7 PII scrubber: fixture transcript with email/phone/key → upload payload contains redacted markers, count shown to user.
- SEC-8 Inert-until-gesture: before any user-triggered capture/inject click, content script performs **zero DOM reads and zero network requests** (network assertion on initial page load + 30 s idle).