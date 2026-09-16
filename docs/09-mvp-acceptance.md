# 09 — MVP Acceptance Criteria

## 1. Purpose
Every criterion is **testable** (Gherkin or assertion) and traces to a user complaint from the competitor study (Chrome Web Store reviews + research) or to a differentiator. A horizontal **H-REQ** = core reliability; **M-** = MCP; **SEC-** = security ([08-security-model](/08-security-model.md) §13).

## 2. Definition of Done (DoD)
- [ ] Feature ships with tests: unit + integration + one E2E Playwright scenario per H-REQ.
- [ ] Docs updated under `docs/` where the feature touches API/schema/UX.
- [ ] All new behavior behind feature flags where non-MVP; every flag off by default.
- [ ] `npm audit` clean (no high/critical), lint + typecheck green.
- [ ] Manual QA checklist passed on the 4 supported platforms (ChatGPT, Claude, Gemini, Gmail).
- [ ] Telemetry event + perf budget recorded (see §7).

## 3. Horizontal reliability (from review complaints)

### H-REQ-1 No duplicate injection after refresh
```gherkin
Scenario: Refresh after successful inject
  Given user injected <v12> into ChatGPT chat
  And composerSession is cleared
  When user refreshes and re-injects SAME capsule+mode into the SAME chat topic
  Then API returns 409 INJECTION_DUPLICATE
  And UI shows "Already injected here — Reinject as new?" 
  And choosing "No" leaves chat unchanged
  And choosing "Yes" re-injects with a NEW composerSession

Scenario: Different chat topic, same day
  Given user starts a new chat (new composerSession)
  When user injects same capsule
  Then injection succeeds and is recorded (deduped:false)
```

### H-REQ-2 Capture never hangs; always shows progress
```gherkin
Scenario: Smart capture of 300-message thread
  Given user on ChatGPT with a 300-message conversation
  When user clicks "Capture" (smart)
  Then popup shows progress stages: scanning→extracting→summarizing→saving
  And progress bar advances monotonically with p95 total < 30 s
  And no capture attempt exceeds 90 s without a terminal state
  And Cancel aborts within 2 s and worker stops (session=cancelled)

Scenario: Raw capture of same thread
  When user clicks "Capture (raw)"
  Then stages show scanning→saving only
  And p95 total < 8 s
```
Metrics checks: progress `refreshedAt` gaps ≤ 5 s during any stage; terminal session within limits.

### H-REQ-3 Injection preserves chat style and token budget
```gherkin
Scenario: Inject full capsule
  Given user injects <capsule with 3,800 tokens estimated>
  Then injected block begins with deterministic preamble and ends with token footer
  And footer shows count equal to server tokenEstimate ± 10%
  And user message count does NOT include a hidden/invisible marker entry
  And host UI does not alter existing message styling (screenshot diff on 3 samples)

Scenario: Smart/summary mode token economy
  Given user selects "smart" mode
  Then payload excludes non-selected sections and footer is smaller than full payload
```
Style drift check: playwright selects an injected block; computed styles (font, bg, monospace) match host composer defaults.

### H-REQ-4 Version identity & immutable history
```gherkin
Scenario: Edit never mutates a version
  Given capsule has v1, v2
  When user edits contents via UI
  Then a NEW version v3 is created with change summary
  And GET v2 still returns original content_hash
  And v2 == v1 content hash (unchanged ancestor preserved)

Scenario: Rollback
  When user "Restore v2" on v5
  Then v6 is created with content == v2 and changeSummary "Restore v2"
```

### H-REQ-5 Edit flow discoverable
```gherkin
Given ≤ 3 clicks from popup menu to version editor (menu → Edit contents → editor)
And "Edit contents" appears in library card menu, popup menu, and detail screen
```

### H-REQ-6 Archive-over-delete & trial downgrade
```gherkin
Scenario: Over free-plan cap
  Given free user at 25/25 active capsules
  When user attempts create-capsule from ANY surface
  Then 403 CAPSULE_LIMIT with friendly message + "Archive instead of delete"

Scenario: Trial expiry
  Given trial ended (trial_ends_at < now)
  When user opens any page
  Then plan banner shows downgrade next steps; counts clamp to Free limits; Pro features read-only (no data loss)
  Given user had 40 active capsules at expiry
  Then all 40 remain visible; ownership preserved; creation blocked until archive/reduce to 25
```

### H-REQ-7 Pricing communicated up-front
```
Free 25 active + unlimited archive · 14-day Pro trial · no card (page copy + register form)
```
Assertion: landing + register + popup show this data (not "5 capsules").

### H-REQ-8 MCP parity across clients
MCP tools work from Cursor **and** Claude Code skill wrappers with identical outputs (differ only transport). Assertion: JSON-RPC tools/call returns same result shape as skill stdout.

### H-REQ-9 Capture from Projects parity
Given user is inside a ChatGPT/Claude Project → capture attaches `projectRef`; re-harvest on chat reopen updates capsule projection. Assertion: `projects.external_ref` set; capsule detail "Re-harvest" enabled.

### H-REQ-10 Privacy signals
`stealthInjection` default on (footer metadata minimal); no egress panels during normal library use (network assertion on non-capture pages).

### H-REQ-11 DOM-change resilience (C-6)
```gherkin
Scenario: Platform renames chat CSS classes (simulated fixture)
  Given adapter fixture with 40% of selector hints removed
  When user captures via text-layer path
  Then capture succeeds with confidence ≥ 0.6 and messages complete
  And popup does NOT show conversion-silent fallback

Scenario: Detection fully broken
  Given adapter detection returns false (platform changed)
  When user tries to capture
  Then UI routes to paste-in fallback with instructive copy
  And pasted transcript produces an identical capsule structure (captureMode: paste)
```

### H-REQ-12 Zero-ingest mode (C-9)
```gherkin
Given user or enterprise enables zeroIngest
When user captures a chat with zeroIngest on
Then no DOM read happens (network+DOM instrumentation assert)
And capture succeeds from paste with captureMode: paste and scrub report shown
And extension host_permissions for reading are runtime-dropped
```

### H-REQ-13 Live capsules — no context rot (C-3)
```gherkin
Given capsule pinned to project and "Keep this capsule updated" enabled
When chat closes after new messages were added
Then a re-harvest runs and creates vN+1 (immutability preserved)
And driftDiff lists added/changed/removed sections since last capture
And changeSummary is generated from the diff
And identical-to-last-harvest runs are skipped as CAPSULE_UNCHANGED
And with consent off, no re-harvest ever runs (network assert)
```

### H-REQ-14 Purpose-driven briefs (C-1/C-2)
```gherkin
Given user selects purpose=handoff, maxTokens=1500, full capsule is 8k tokens
When user injects
Then payload tokens ≤ 1500 and required handoff sections present
And excluded sections are listed in the preview
And "+ Insert <section>" deepens the conversation in follow-up injections
```

### H-REQ-15 Attach-as-file mode (C-2/C-3)
```gherkin
Scenario: Host supports native files (ChatGPT, Claude, Gemini)
  Given capsule=12k tokens, mode=attach, target supports files
  When user selects [Attach to chat]
  Then a .context.md file is produced with front-loaded objective-first brevity block
  And the file ≤ 4k tokens (objective + top 3 sections by importance)
  And the host file picker receives the file; composer text input is empty
  And injection is recorded with mode=attach
```

### H-REQ-16 Inert-until-gesture & blocker resilience (C-11)
```gherkin
Scenario: Page idle before user action
  Given the extension is loaded on chatgpt.com
  When no Capture/Inject button has been clicked
  Then content script performs 0 DOM reads and 0 network requests (network+DOM assertion for 30 s idle)

Scenario: Ad-blocker blocks content script execution
  Given uBlock blocks the registered content script
  When user clicks Capture
  Then the popup detects blocked world status within 2 s
  And routes user to paste-in fallback with instructions
  And library/MCP remain fully functional (core services not degraded)
```

### H-REQ-17 Terminal session resilience (C-8)
```gherkin
Scenario: Long-lived terminal session
  Given user authenticates via /capsule-login
  When 20 days pass without manual re-login
  Then refresh token auto-rotates silently via OS keychain
  And no mid-task auth prompts occur

Scenario: Terminal token finally expires
  Given refresh token hits 30-day ceiling
  When user runs a /capsule-* skill
  Then an inline rescue link is printed (open browser) and skill continues after browser login
  And re-login takes ≤ 15 s including browser redirect
```

### H-REQ-18 Capture hygiene — no "Untitled-12" (C-5)
```gherkin
Scenario: Capture with related capsule
  Given capsule "Ecoru Revamp" (v7) exists with matching name/summary
  When user captures a new chat with topic "Ecoru revamp"
  Then the popup suggests "Update Ecoru Revamp (v7) instead of creating new?"
  And choosing Yes routes through the new_version path (no duplicate capsule)
  And capsule name defaults to the transcript title head (no "Untitled")

Scenario: Fresh unrelated capture
  When user captures a brand-new topic
  Then capsule name is auto-set from the first user message head
  And auto-tag is derived from platform + detected project
```

## 4. MCP acceptance
- M-1 search returns only tenant-scoped results (cross-workspace query → 0 rows).
- M-2 create at 25/25 free → `403 CAPSULE_LIMIT` surfaced with `isError: true`.
- M-3 invalid/missing/revoked `X-API-Key` → `INVALID_API_KEY` (24 s maximal cache for revoked; see SEC-2).
- M-4 messages > 500 → `422 VALIDATION_ERROR` with count in details.
- M-5 write scoped token cannot call `create_capsule` → `403 FORBIDDEN`.
- M-6 after token revoke, in-flight poll retry fails cleanly.
- M-7 skills install via `setup.sh` idempotent; 401 prompts re-login.
- M-8 `threadcap setup` (D-016) completes install + config + auth in one run; repeat runs are idempotent and re-verify auth.

## 5. Performance budgets (p95, Railway free-ish instance, 1 msg ≈ 1k tokens)
| Surface | Budget |
|---|---|
| Popup open (local) | < 300 ms |
| Library list load (25 caps) | < 250 ms API time |
| Capture raw (300 msgs) end-to-end | < 8 s |
| Capture smart (300 msgs) end-to-end | < 30 s |
| Inject prepare (full, 3.8k tokens) | < 150 ms |
| Search (semantic, 10k chunks) | < 300 ms |
| Version create (10 sections) | < 400 ms |
| Share link open cold | < 600 ms |
| SW wake → message handled | < 50 ms |

**Free-tier annotations (D-020):**
- All budgets above are **warm steady-state** p95 targets on the free stack ([11-deployment](/11-deployment.md) §1).
- **Neon scale-to-zero**: the first DB query after ~5 min idle adds ~300 ms–1 s cold-start to any path that touches Postgres (search, version create, library list if cache-cold). Acceptable on free tier; the H-REQ-* behavioral requirements are measured after the query has warmed the compute.
- **Search** budget assumes Redis-cached hot results; a cache-miss cold path may add the Neon cold-start term.
- **Capture smart (30 s)** is AI-provider-bound, not infra-bound; the pipeline progress UI must still report live stages even if the 30 s target slips under free-tier provider latency.
- Budgets are re-verified on the paid stack before the public-beta scale gate (guardrail in [10-roadmap](/10-roadmap.md) §Guardrails); free-tier is not the acceptance baseline for the 99.9% uptime NFR.

## 6. E2E test matrix (Playwright)
- Web: register → OAuth → create capsule → edit → versions → rollback → archive → restore → share link viewer.
- Extension: capture progress → inject → dedupe 409 → auto-drop hint → fetch onProjects capsule.
- Extension resilience: simulated DOM-break fixture → text-layer path + paste fallback (H-REQ-11).
- Extension blocker: uBlock-injected stub blocks content script → paste fallback path (H-REQ-16).
- Extension zero-ingest: capture with `zeroIngest` → DOM-read assert negative + scrub report (H-REQ-12, SEC-6/7).
- Extension inert: idle page → 0 DOM+network (H-REQ-16, SEC-8).
- Attach-as-file: target=ChatGPT, mode=attach → .context.md file produced, composer text empty (H-REQ-15).
- Live capsule: re-harvest on close → vN+1 + driftDiff present; consent-off → no network re-harvest (H-REQ-13).
- Briefs: purpose+budget inject → under-budget payload + deepen on demand (H-REQ-14).
- Capture hygiene: "Ecoru revamp" capture with existing v7 → update prompt; new topic → auto-name + auto-tag (H-REQ-18).
- MCP: cursor header-auth tool-calls against test workspace; skills smoke via `npx`; `threadcap setup` idempotency.
- Security e2e: cross-tenant 404, revoked token 401, E2EE decrypt test.
Run headless in CI (chromium desktop + mobile viewport smoke).

## 7. Release gates (MVP ship)
1. All H-REQ Gherkin green (Playwright + API tests).
2. Perf budgets met on staging under synthetic load (100 active users breach threshold → block).
3. `npm audit` no high/critical; lint/typecheck; seed-data scenario (10k capsules) under limits.
4. Manual QA pass on 4 platforms + 2 email providers.
5. **Free-tier budget gate** (D-020): Neon CU-hours/egress, Upstash 500K cmd/mo, Railway $1 credit, and 0.5 GB volume projected within free limits for the next month — otherwise the release includes the [11-deployment](/11-deployment.md) §10 upgrade. No regressions on the D-011 con-countermeasure baseline (H-REQ-11..16).
5. Privacy policy + terms live; landing demo (ws_demo) tested; `robots.txt`/`/.well-known/mcp.json` verified.
6. Telemetry dashboards exist for capture durations, injection dedupe rate, trial→paid funnel.

## 8. Non-goals for MVP (defer)
- Multi-account capture, offline-first capture, mobile apps, plugin stores beyond Chrome, on-device keychain E2EE, webhooks, LDAP/SCIM, billing metering …→ see [10-roadmap](/10-roadmap.md).