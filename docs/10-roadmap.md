# 10 — Roadmap

MVP (Phase 1) ships the full scope of this spec. Phases 2–3 add the V2/V3 flags already stubbed in the API ([openapi.yaml](/openapi.yaml) `x-v2-stubs`) and the survey-derived differentiators marked as future in [07-ux-screens](/07-ux-screens.md).

## Phase 1 — MVP (this spec)
- **Free-first stack** (D-020/D-021): public GitHub repo (unlimited Actions + Pages), web + API/MCP (merged single service) + skills + lander on Railway Free, PostgreSQL 16 + pgvector on Neon free, Redis on Upstash free ([01-architecture](/01-architecture.md) §3, [11-deployment](/11-deployment.md)).
- Web app + API; H-REQ-1..17 must pass on the free stack before public beta.
- Chrome MV3 extension, 4 chat/email platforms, capture pipeline + inject + dedupe + auto-drop (H-REQ-1..10).
- MCP server (7 tools, merged into the api service, D-021) + skills; API tokens; Teams MVP (read/join + owner-create); share links; billing (Stripe) behind free/pro/team tiers.
- E2EE Enterprise flag only (server-assisted); E2EE client-only = Phase 3.5 gate.
- **Con countermeasures shipped in MVP** (H-REQ-11..14 + D-012..D-016, mapped in [00-index](/00-index.md) §6.2): purpose-driven briefs + token budgets + deepen-on-demand; selector-free adapters + universal paste-in fallback; live capsules (consented re-harvest + drift diff); zero-ingest capture + PII scrubber; one-command `threadcap setup`.

### MVP definition of "competitive moat"
Capsule Hub positioning today = free 5-capsule upsell; ThreadCap default trustworthy: progress-captures, no duplicates, token-honest injects, archive-not-delete, per-screen privacy toggles. See [00-index](/00-index.md) §6 competitive summary.

## Phase 2 — Extend content intelligence & collab (V2)

V2 gates on: live on Pro+ users ≥ 20k; storage & index costs verified. Every feature ships behind a feature flag until acceptance checks in [09](/09-mvp-acceptance.md) §3 pass. Phase 2 targets 8 weeks after RP-2 (MVP public beta).

### V2 Feature 1 — Near-duplicate detection (countermeasure C-5)

**Problem:** Users capture from the same chat/project repeatedly. Session bloat accumulates; finding "the exact capsule" is manual.

**Design:**

- **Capture-time suggestion (always on):** before saving a new capsule, `POST /v1/capsules/related` (name + summary embedding cosine search; threshold ≥ 0.82). If a hit lands, the capture popup shows:

  ```
  This looks like "Ecoru Revamp" (v12) — update it instead?
  [Create new capsule]  [Update Ecoru Revamp → v13]
  ```

  "Update" routes through `target.action = new_version` + `target.capsuleId = cap_…`. The user always decides; ThreadCap never silently supersedes.

- **Auto-route by tag/project (opt-in, Settings → Preferences):** when a capsule name + summary matches an existing tag+project pair above the threshold, auto-select that tag + project in the creation form. The user confirms with one click; never a silent move.

- **Batch dedupe pass (manual trigger):** from Library → "Find duplicates" → server runs embedding similarity across the user's active capsules → surfaces clusters with a suggested primary. User merges or dismisses per cluster. `POST /v1/capsules/dedupe/preview` → `200 { clusters: [{ primaryId, duplicates[], similarity }] }`. Confirm: `POST /v1/capsules/dedupe/execute { primaryId, duplicateIds[], action: "merge"|"archive" }`.

- **API surface (V2, replaces stub):**

  - `POST /v1/capsules/related` `{ "name", "summary?", "excludeId?" }` → `200 { items: [{ capsuleId, name, similarity, versionCount }] }`
  - `POST /v1/capsules/dedupe/preview` → `200 { clusters[] }`
  - `POST /v1/capsules/dedupe/execute` → `200 { merged: number, archived: number }`

- **Acceptance gate:** false-positive rate < 8% on a 1,000-capsule test corpus; merge preserves all versions + attachments.

---

### V2 Feature 2 — Context Replay / timeline graph

**Problem:** "When did we decide X?" is unanswerable from a flat version list.

**Design:**

- **Timeline graph** in the capsule detail *Graph* tab: time-bucketed version nodes (hour/day/week) with edges showing parent lineage, branch points, and rollback clones. Hover shows version summary; click opens that version's diff.

- **Diff-over-time view:** select any two versions → section-level diff (additions/deletions/changes) with inline annotations. Exports as markdown diff.

- **Traceability query:** `GET /v1/capsules/:id/replay?fromVersion=ver_…&toVersion=ver_…` → `200 { timeline: [{ versionId, ts, authorId, changeSummary, sectionsChanged[] }] }`.

- **CapsuleIndex integration:** the graph exposes `decisions ↔ versions` and `requirements ↔ versions` links, so "which version introduced requirement R-7?" is one click.

- **API surface (V2):**

  - `GET /v1/capsules/:id/timeline` → `200 { nodes: [{ versionId, ts, bucket, authorId, changeSummary }], edges: [{ from, to, type }] }`
  - `GET /v1/capsules/:id/replay?fromVersion&toVersion` → `200 { timeline[] }`

- **Acceptance gate:** renders in < 500 ms for capsules with ≤ 200 versions; graph uses Canvas2D (no WebGL dependency for MVP).

---

### V2 Feature 3 — Branching + merge with conflict resolution

**Problem:** A capsule diverges for engineering vs product; merging back is manual copy-paste.

**Design:**

- **Branch creation:** `POST /v1/capsules/:id/branches` `{ "name": "product-view", "fromVersionId": "ver_…" }` → `201 { branch: { id, name, headVersionId, createdAt } }`. Branches are labels on the version tree; no data duplication until edits diverge.

- **Branch edit:** edits on a branch create versions with `branchId` set; the main line remains untouched. The version history tree shows branch lanes visually.

- **Merge:** `POST /v1/capsules/:id/branches/:branchId/merge` `{ "strategy": "ours"|"theirs"|"manual" }` → `201 { version }`. For `manual`, the server returns `200 { conflicts: [{ sectionPath, ours, theirs }] }`; the user resolves in the web editor, then `POST` again with `{ resolvedContent }`.

- **Diff before merge:** `GET /v1/capsules/:id/branches/:branchId/diff?into=main` → `200 { sections: [{ path, status: "added"|"modified"|"deleted"|"conflict", ours?, theirs? }] }`.

- **Acceptance gate:** merge of ≤ 10 conflicting sections completes in < 2 s; branch tree renders correctly with ≥ 3 concurrent branches.

---

### V2 Feature 4 — Semantic Q&A (chat with your capsule corpus)

**Problem:** "What did we decide about rate limiting?" requires reading every capsule manually.

**Design:**

- **Q&A tab** in capsule detail + global Q&A in Library sidebar. Scoped to: current capsule, current team, or all user-owned capsules.

- **RAG pipeline:** user query → embedding → pgvector top-k retrieval over `embedding_chunks` (section-level chunks, chunk size = 512 tokens) → re-rank by relevance → LLM answer with inline citations (`[cap_… v3 §requirements]`).

- **Citations are clickable:** each citation opens the capsule version + section in a side panel. The answer includes a "Source capsules" list below.

- **API surface (V2, replaces stub):**

  - `POST /v1/search/qa` `{ "query", "scope": "capsule"|"team"|"all", "capsuleId"?, "teamId"?, "maxSources": 5 }` → `200 { answer, sources: [{ capsuleId, versionId, section, snippet, score }] }`

- **Token budget:** Q&A answers capped at 1,500 tokens; sources list is separate (does not count toward the answer cap).

- **Acceptance gate:** answer latency p95 < 3 s; citation accuracy ≥ 90% on a 200-question test set; sources are always real capsule sections (no hallucinated citations).

---

### V2 Feature 5 — SDK auto-extractor (countermeasure C-7)

**Problem:** Capsule Hub's SDK requires custom `onExtract`/`initDropZone` code; most users cannot integrate.

**Design:**

- **Headerless default extractor presets** for 10 common chat UIs (ChatGPT, Claude, Gemini, DeepSeek, Perplexity, Poe, You.com, Phind, Cursor chat, Windsurf chat). Presets are versioned and hosted at `extractors.threadcap.app/presets/v{N}.json`; the SDK fetches the matching preset by `hostname` automatically — zero config.

- **`captureFrom({ messages })` zero-config path:** any website can call `ThreadCap.captureFrom({ messages: [{ role, content, ts }] })` without knowing the DOM. The SDK normalizes the message array and sends it to the API. This is the paste-in equivalent for SDK-embedded sites.

- **`onExtract` stays optional:** power users can override the default extractor with a custom function that returns `{ messages, attachments, projectRef }`. The default extractor runs if `onExtract` is not provided.

- **Widget auto-detect:** `ThreadCap.boot()` checks `window.location.hostname` against the preset registry; if a match is found, the capture button appears automatically. No `initButton()` call needed for supported sites.

- **API surface (SDK package):**

  ```ts
  // Zero-config (default extractor)
  ThreadCap.boot({ apiKey: 'cht_…' })  // auto-detects site, shows capture button

  // Zero-config from messages (no DOM)
  ThreadCap.captureFrom({ messages: [...] })

  // Power-user override
  ThreadCap.boot({
    apiKey: 'cht_…',
    onExtract: () => ({ messages: [...], attachments: [...] })
  })
  ```

- **Acceptance gate:** default extractor works on all 10 presets without configuration; `captureFrom` produces a valid capsule from a plain message array in < 500 ms.

---

### V2 Feature 6 — Webhooks + export

**Problem:** Teams need to pipe capsule events into CI/CD, Slack, or internal tools.

**Design:**

- **Webhook CRUD:**

  - `POST /v1/webhooks` `{ "url", "events": ["capsule.created", "capsule.version_created", "injection.created"], "secret" }` → `201 { webhook: { id, url, events, secret, active } }`
  - `GET /v1/webhooks` → `200 { items[] }`
  - `POST /v1/webhooks/:id/test` → `200 { delivered: true, status: 200 }` (sends a test event)
  - `DELETE /v1/webhooks/:id` → `204`

- **Event payload:**

  ```json
  {
    "event": "capsule.version_created",
    "ts": "2026-10-01T12:00:00.000Z",
    "data": {
      "capsuleId": "cap_…",
      "versionId": "ver_…",
      "versionNumber": 7,
      "changeSummary": "Extended from ChatGPT chat",
      "authorId": "usr_…"
    }
  }
  ```

- **HMAC-SHA256 signing:** every delivery includes `X-ThreadCap-Signature: sha256=…` computed over the raw body with the webhook secret. Consumers must verify before processing.

- **Retry policy:** 3 attempts with exponential backoff (10 s, 60 s, 300 s). After 3 failures, webhook marked `active: false` + admin notification.

- **Export (admin/settings):** `GET /v1/capsules/:id/export?format=zip|md` → `200` (zip = full capsule + all versions + attachments; md = markdown bundle). Pro+ only.

- **Acceptance gate:** webhook delivery p95 < 5 s; HMAC verification test passes; retry failure disables webhook + sends notification email.

---

### V2 Feature 7 — Split / merge capsules

**Problem:** A large capsule accumulates 50+ requirements across 3 projects; users want to carve out focused sub-capsules.

**Design:**

- **Split:** `POST /v1/capsules/:id/split` `{ "sectionIds": ["req_3", "req_7", "dec_1"], "name": "Auth requirements", "mode": "copy"|"move" }` → `201 { capsule: {…}, version: {…} }`. `copy` duplicates the selected sections into a new capsule (original unchanged); `move` removes them from the source and creates vN+1 on the source.

- **Merge:** `POST /v1/capsules/merge` `{ "sourceIds": ["cap_…", "cap_…"], "name": "Combined", "conflictResolution": "keep-all"|"newest-wins" }` → `201 { capsule, version }`. Sections from all sources are concatenated with dedupe (by `id`); conflicts resolved per the chosen strategy.

- **Acceptance gate:** split of 5 sections from a 30-section capsule completes in < 1 s; merge of 3 capsules with 10 sections each produces a valid 30-section capsule; original capsules retain full version history regardless of `mode`.

---

### V2 Feature 8 — Attachment OCR / structured extraction

**Problem:** PDFs, invoices, and screenshots contain structured data that is invisible to search.

**Design:**

- **OCR stage** added to the capture pipeline `extracting` phase: when an attachment is a PDF or image, the extraction worker runs OCR (Tesseract for images, pdf-parse for PDFs) and stores the extracted text in `attachment.meta.text`.

- **Invoice-to-requirements:** optional AI pass that converts invoice line items into `requirements` entries with `{ text, status: "open" }`. User confirms before saving.

- **Provider-dependent:** not promised at Q2 GA; ships behind a flag when the OCR pipeline is stable. Acceptance gate: OCR accuracy ≥ 95% on a 100-page test set (English, clean scans).

---

### V2 Feature 9 — Pruning + version dedupe

**Problem:** Capsules with 100+ versions accumulate storage cost; many versions are near-identical.

**Design:**

- **Pruning pass:** from Library → "Prune versions" → server identifies versions where `contentHash` is identical to the next version (no content change, only metadata) → suggests removal. User confirms per capsule. `POST /v1/capsules/:id/prune` `{ "keep": 10 }` → `200 { pruned: number, kept: number }`. Always keeps the current version + the last N versions + all branch heads.

- **One-shot dedupe:** same as pruning but across the user's entire library. `POST /v1/capsules/prune/all` `{ "keep": 5 }` → `200 { totalPruned }`. Pro+ only.

- **Acceptance gate:** pruning never removes the current version; always preserves branch heads; storage savings ≥ 20% on a 100-version capsule test set.

---

### V2 Feature 10 — E2EE client-only supplement

**Problem:** Server-assisted E2EE (MVP) requires trust in the server for key management; power users want full client control.

**Design:**

- **Client-only key generation:** browser generates an Ed25519 keypair; private key stays in `IndexedDB` (never leaves the device). Public key registered with the server; capsule content encrypted client-side with a symmetric key (AES-256-GCM) that is itself encrypted with the user's public key.

- **Recovery:** 24-word BIP-39 recovery phrase generated at setup; stored offline by the user. Loss of the key + recovery phrase = permanent data loss (ThreadCap cannot recover).

- **Compatibility:** client-only E2EE capsules are marked `e2eeMode: "client-only"` in metadata; the server stores only ciphertext. RAG/search over encrypted capsules is not available (acceptance tradeoff). The user is warned at setup.

- **Acceptance gate:** key generation + encryption + decryption round-trip in < 500 ms on a mid-range laptop; recovery phrase import restores access in < 2 s.

---

### V2 API surface additions (replaces stubs in openapi.yaml)

| Endpoint | Method | Status | Notes |
|---|---|---|---|
| `/v1/capsules/related` | POST | **New (V2)** | Near-dup suggestion at capture time |
| `/v1/capsules/dedupe/preview` | POST | **New (V2)** | Batch dedupe scan |
| `/v1/capsules/dedupe/execute` | POST | **New (V2)** | Execute merge/archive |
| `/v1/capsules/:id/timeline` | GET | **New (V2)** | Version timeline graph |
| `/v1/capsules/:id/replay` | GET | **New (V2)** | Traceability query |
| `/v1/capsules/:id/branches` | POST | **New (V2)** | Create branch |
| `/v1/capsules/:id/branches/:branchId/diff` | GET | **New (V2)** | Branch diff |
| `/v1/capsules/:id/branches/:branchId/merge` | POST | **New (V2)** | Merge branch |
| `/v1/search/qa` | POST | **Promoted from stub** | Semantic Q&A |
| `/v1/capsules/:id/split` | POST | **Promoted from stub** | Split capsule |
| `/v1/capsules/merge` | POST | **Promoted from stub** | Merge capsules |
| `/v1/capsules/:id/prune` | POST | **New (V2)** | Version pruning |
| `/v1/capsules/prune/all` | POST | **New (V2)** | Batch pruning |
| `/v1/capsules/:id/export` | GET | **New (V2)** | Export zip/markdown |
| `/v1/webhooks` | POST/GET | **Promoted from stub** | Webhook CRUD |
| `/v1/webhooks/:id/test` | POST | **New (V2)** | Webhook test fire |
| `/v1/webhooks/:id` | DELETE | **New (V2)** | Webhook revoke |

### V2 perf targets

- `search_context` handles > 50k chunks/corpus; p95 < 500 ms.
- Smart capture batch API (streaming progress events via SSE) for 500+ messages.
- Q&A answer latency p95 < 3 s.
- Timeline graph render p95 < 500 ms for ≤ 200 versions.
- Webhook delivery p95 < 5 s.
- Near-dup suggestion appears in < 800 ms during capture.

## Phase 3 — Growth & distribution
| Item | Notes |
|---|---|
| Firefox + Edge builds (same codebase) | Ponyfills per MV3/Polyfill |
| Package installer (`.threadcap` file) | share capsule bundles without link accounts |
| Mobile/web PWA responsive readonly + capture | read-only browsing + quick capture light |
| Sandboxed SSE relay for streaming captures | when AI autosave needed at scale |
| Marketplace: 3rd-party capsule packs | earn share on packs |
| Team folders + approvals | org workflows |
| Continuous capture (opt-in chat-mirroring) | behind double consent (privacy max) |
| Golden prompt gallery | community-shared prompts |

## Phase 4 — Enterprise
SSO/SCIM (Okta/Azure), on-prem-deployable workers (privacy), E2EE client-only GA, S3-native BYO storage, audit export, per-team retention policies, API SLA. **Zero-ingest org policy** (admin-forced, log every capture source) + PII scrub pattern packs go GA here (MVP ships the per-user toggles per D-015).

## Guardrails on the roadmap
1. **V2 gate**: live on Pro+ users ≥ 20k; storage & index costs verified.
2. **V3 gate**: mobile conversion blockers researched; PWA checklist; polyfill perf on Edge/Firefox.
3. **Never regress the H-REQ baseline** — every new feature re-runs [09 §3] checks.
4. **Revenue-first**: E2EE and packs ship only when screw-backed (billing ready); content features land behind flags for rollout.
5. Competition lane: monitor Capsule Hub moats (pricing vs functionality); keep default-free tier above theirs (25 vs 5) and archive-not-delete sanity as long-term differentiator.
6. **Never regress the con-countermeasure baseline** (D-011): briefs, paste fallback, zero-ingest, consented re-harvest stay on every release; roadmap items that increase prompt size or machine-fetch scope must first pass the [09 §3] H-REQ-11..14 gates.
7. **Free-tier budget prime directive** (D-020): the free stack ($0) is the hosting default through early beta. No roadmap item may silently depend on paid infra — any item whose size/CPU/e2e/cold-start behavior would breach the §1 free limits must first pass the [09 §7] gate 5 (budget projection) and carry an explicit upgrade plan from [11-deployment](/11-deployment.md) §10. Uptime on free tier is best-effort by design; never advertise 99.9% until the paid-stack upgrade has landed.

## Milestones (RP = release point)
- RP-1 (MVP-lite, internal): capture(inject, dedupe) + web library + auth; 4 platforms — internal only.
- RP-2 (MVP full): everything in this spec + billing + MCP + skills + demo; public beta on the free-first stack — free-tier budget gate ([09 §7](/09-mvp-acceptance.md) gate 5) must pass; upgrade to Hobby/Pro is the deployment action when the §10 triggers in [11-deployment](/11-deployment.md) fire, not a phase milestone.
- RP-3 (V2): data intelligence increment (Q&A + branch/merge + replay); E2EE server-assisted.
- RP-4 (V3): distribution increment (FF/Edge, PWA, packages).
- RP-5 (Enterprise): SSO/SCIM + E2EE client-only GA + SLA.

Phase 1 scoping table (what's in/out) is maintained in [00-index](/00-index.md) §5-6.