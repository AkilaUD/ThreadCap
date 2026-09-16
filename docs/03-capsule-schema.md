# 03 — Capsule JSON Schema

**Spec:** JSON Schema draft 2020-12. Single source of truth lives in `packages/shared-types/capsule.schema.json`. This doc is the normative definition (the file imports it).

## 1. Document (version snapshot) — `CapsuleVersion`

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://threadcap.app/schemas/capsule-version.schema.json",
  "title": "CapsuleVersion",
  "type": "object",
  "required": [
    "id", "capsuleId", "versionNumber", "parentVersionId", "branchId",
    "authorId", "changeSummary", "content", "contentHash", "createdAt"
  ],
  "properties": {
    "id":            { "type": "string", "pattern": "^ver_[0-9A-Za-z]{24}$" },
    "capsuleId":     { "$ref": "#/$defs/capsuleId" },
    "versionNumber": { "type": "integer", "minimum": 1 },
    "parentVersionId": { "anyOf": [{ "$ref": "#/$defs/verId" }, { "type": "null" }] },
    "branchId":      { "anyOf": [{ "type": "string" }, { "type": "null" }] },
    "authorId":      { "$ref": "#/$defs/usrId" },
    "changeSummary": { "type": "string", "maxLength": 300 },
    "content":       { "$ref": "#/$defs/capsuleContent" },
    "contentHash":   { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "tokenEstimate": { "type": "integer", "minimum": 0, "optional": true },
    "createdAt":     { "$ref": "#/$defs/timestamp" }
  },
  "$defs": {
    "capsuleId": { "type": "string", "pattern": "^cap_[0-9A-Za-z]{24}$" },
    "verId":     { "type": "string", "pattern": "^ver_[0-9A-Za-z]{24}$" },
    "usrId":     { "type": "string", "pattern": "^usr_[0-9A-Za-z]{24}$" },
    "timestamp": { "type": "string", "format": "date-time" },
    "capsuleContent": {
      "type": "object",
      "required": ["objective", "background", "requirements", "constraints",
                   "decisions", "assumptions", "openQuestions",
                   "conversation", "attachments", "links", "summary"],
      "properties": {
        "objective":     { "type": "string" },
        "background":    { "type": "string" },
        "requirements":  { "$ref": "#/$defs/contextItemArray" },
        "constraints":   { "$ref": "#/$defs/contextItemArray" },
        "decisions":     { "$ref": "#/$defs/contextItemArray" },
        "assumptions":   { "$ref": "#/$defs/contextItemArray" },
        "openQuestions": { "$ref": "#/$defs/contextItemArray" },
        "conversation":  { "type": "array", "items": { "$ref": "#/$defs/message" } },
        "attachments":   { "type": "array", "items": { "$ref": "#/$defs/attachmentRef" } },
        "links":         { "type": "array", "items": { "$ref": "#/$defs/link" } },
        "summary":       { "type": "string", "description": "non-verbatim semantic summary for search (never conversation text)" }
      }
    },
    "contextItemArray": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "text"],
        "properties": {
          "id":   { "type": "string" },
          "text": { "type": "string" },
          "status": { "type": "string", "enum": ["open", "accepted", "superseded", "rejected"], "optional": true }
        }
      }
    },
    "message": {
      "type": "object",
      "required": ["role", "content", "ts"],
      "properties": {
        "role":        { "type": "string", "enum": ["user", "assistant", "system"] },
        "content":     { "type": "string" },
        "ts":          { "$ref": "#/$defs/timestamp" },
        "sourceTool":  { "type": "string", "optional": true, "examples": ["chatgpt.web", "claude.web", "anthropic.cli"] },
        "tokenEstimate": { "type": "integer", "minimum": 0, "optional": true }
      }
    },
    "attachmentRef": {
      "type": "object",
      "required": ["id", "name", "mimeType", "size", "role"],
      "properties": {
        "id":       { "type": "string", "pattern": "^att_[0-9A-Za-z]{24}$" },
        "name":     { "type": "string" },
        "mimeType": { "type": "string" },
        "size":     { "type": "integer" },
        "role":     { "type": "string", "enum": ["source", "generated", "manual"] }
      }
    },
    "link": {
      "type": "object",
      "required": ["url", "label"],
      "properties": { "url": { "type": "string", "format": "uri" }, "label": { "type": "string" } }
    }
  }
}
```

## 2. Capsule top-level (list/read shape) — the wrapper

```jsonc
{
  "id": "cap_01HZXV…",
  "workspaceId": "ws_01HZX…",
  "teamId": "tm_… | null",
  "projectId": "prj_… | null",
  "name": "Ecoru Revamp Requirements",
  "description": "Modernize Ecoru frontend preserving MVC/validation parity.",
  "status": "active",                     // active | archived | deleted
  "source": {
    "platform": "chatgpt",                // chatgpt|claude|gemini|gmail|terminal|web|manual
    "projectRef": "f3a9…",                // external chat/project id for re-harvest
    "capturedAt": "2026-09-16T09:30:00.000Z"
  },
  "primaryTag": "ecoru",
  "tags": ["ecoru", "requirements"],
  "versionCount": 4,
  "currentVersionId": "ver_…",
  "latestVersion": { /* CapsuleVersion (summary + counts, full content on detail) */ },
  "createdAt": "2026-09-01T08:00:00.000Z",
  "updatedAt": "2026-09-16T09:30:00.000Z"
}
```

### Field rules
- `name` required, 1–120 chars. `description` optional, ≤ 500.
- `status` transitions: `active ⇄ archived`; `active/archived → deleted` (soft). Archive is **unlimited on every tier**.
- `source.platform` drives capture-time behavior (`gmail` harvests the thread; `terminal` = /capsule-save, etc.).
- Tags max 20; `primaryTag` = first tag for badge rendering & folder fallback.

## 3. Message format (harvest canonical)

```jsonc
{
  "role": "assistant",
  "content": "The loan-approval flow needs client + server validation…",
  "ts": "2026-09-15T14:02:11.000Z",
  "sourceTool": "chatgpt.web",
  "tokenEstimate": 412
}
```
- `sourceTool` is registry-verified (`chatgpt.web`, `claude.web`, `gemini.web`, `gmail.web`, `anthropic.cli`, `web.manual`).
- Harvest order preserved (ascending `ts`); messages are **immutable within a version**; edits create a new version (D-005).

## 4. Content hash & versioning rules (D-005)

```text
canonical_json = stable_stringify(version.content)   // key order fixed, no whitespace, attrs sorted
content_hash   = sha256(canonical_json)
```
- Creating version N+1 with **identical** `content_hash` to N → skipped with `409 CAPSULE_UNCHANGED` unless `force: true`.
- Rollback: create version M whose `content_json` deep-equals version K (K < M); `parent_version_id = K`; `change_summary = "Rollback to v3"`.
- Inline edit (see [05-extension](/05-extension.md) §8): edit latest → server diffs vs `current_version.content_hash` → creates vN+1 with `change_summary` auto-generated: `"Edited requirements 2, added decision 1"`.

## 5. Branches / merge / split (V1 reserved, V2 full)

- MVP: `branchId` column present, always `null`. Splitting creates a new capsule from selected messages (`POST /v1/capsules/:id/split`, V2).
- Merge (V2): `POST /v1/capsules/merge` takes `capsuleIds`, dedupes `content_hash`-identical sections/messages, stitches conversation by `sourceTool+ts`, emits `change_summary` describing the union, creates a merged version.

## 6. E2EE envelope variant (Enterprise)

When `users.e2ee_enabled = true`, the version `content.conversation`, `content.attachments[].meta`, and section text strings are stored as ciphertext envelopes:

```jsonc
{
  "v": 1,
  "alg": "AES-256-GCM",
  "enc": "base64",                      // ciphertext bytes
  "iv": "…", "tag": "…",
  "kid": "usr_…:2026-09-16"
}
```
- Keys: client generates a 256-bit DEK; DEK wrapped (RSA-OAEP, 3072) by per-user KEK; KEK stored in the **KMS/Vault** provider (Railway env-only config, or cloud KMS on Enterprise). Server can unwrap **per-request** (Trusted Custodian) or not at all (client-only mode). (Details: [08-security-model](/08-security-model.md) §6.)
- Retrieval on E2EE+client-only mode degrades to key-store tag search + plaintext sidecar summaries — clearly labeled in UI.

## 7. Token estimation

`tokenEstimate` per message/content computed with a language-agnostic estimator (≈ `chars / 4` for Latin, `chars / 1.5` for CJK; optional model-accurate `tiktoken`/`cl100k_base` cache). Used for the injection footer and dynamic-context budgeting: **never inject more than an explicit cap** (Pro default 24k, configurable per injection).

## 8. Worked examples

### 8.1 Capture from a ChatGPT thread (smart, partial)
```jsonc
{
  "id": "ver_0A1B2C3D4E5F6A7B8C9D0E1F",
  "capsuleId": "cap_0A1B2C3D4E5F6A7B8C9D0E1F",
  "versionNumber": 1,
  "parentVersionId": null,
  "branchId": null,
  "authorId": "usr_0A1B2C3D4E5F6A7B8C9D0E1F",
  "changeSummary": "Initial capture — Loan module requirements",
  "content": {
    "objective": "Modernize the loan approval flow for Ecoru with client + server validation parity.",
    "background": "Legacy ASP.NET MVC monolith; new React frontend with .NET 10 API. Loan minimum 10,000.",
    "requirements": [
      { "id": "r1", "text": "Loan minimum amount must be 10,000.", "status": "accepted" },
      { "id": "r2", "text": "Validation must run before submission.", "status": "accepted" }
    ],
    "constraints": [ { "id": "c1", "text": ".NET 10; Azure-hosted; no new DB vendors." } ],
    "decisions": [ { "id": "d1", "text": "React + TypeScript frontend." }, { "id": "d2", "text": "Validation centralized in API layer." } ],
    "assumptions": [ { "id": "a1", "text": "Customer is a natural person, 18+." } ],
    "openQuestions": [ { "id": "q1", "text": "Approval sign-off SLA — is 2 business days acceptable?" } ],
    "conversation": [
      { "role": "user", "content": "We need the loan application changed so that…", "ts": "2026-09-15T14:01:00.000Z", "sourceTool": "chatgpt.web" },
      { "role": "assistant", "content": "Here's a plan: client-side + server-side validation…", "ts": "2026-09-15T14:02:11.000Z", "sourceTool": "chatgpt.web" }
    ],
    "attachments": [
      { "id": "att_0A1B2C3D4E5F6A7B8C9D0E1F", "name": "loan-spec-v2.pdf", "mimeType": "application/pdf", "size": 204800, "role": "source" }
    ],
    "links": [ { "url": "https://chatgpt.com/share/abc123def456", "label": "Original thread" } ],
    "summary": "Loan approval modernization with dual-layer validation, minimum 10,000, React+dNET10."
  },
  "contentHash": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
  "tokenEstimate": 1840,
  "createdAt": "2026-09-16T09:30:00.000Z"
}
```

### 8.2 Raw capture (no smart extraction) — content equal to normalized source
- `objective` = auto-title (first user message truncated 160), `background` = "", all context sections empty, `conversation` fully populated, `summary` = first 200 chars of the thread.
- `mode` surface distinction retained via `source.platform` + `captureMode` in `meta` (not shown above to keep schema stable).

### 8.3 Gmail thread → capsule
- `source.platform = "gmail"`; `conversation[].role` = `user` for senders, `assistant` for the email body best-match (subject as first message content prefixed `RE:`); attachments harvested from the thread.

### 8.4 Terminal save (/capsule-save)
- `source.platform = "terminal"`; `conversation` = filtered CLI transcript; additional flags `tag`/`team` set `tags` and `teamId`.

## 9. Validation & tooling
- `zod` schemas generated from this JSON Schema (`packages/shared-types`) are the runtime validator on API + MCP + SDK.
- `content_hash` correctness is verified on every version write (unit-tested canonical stringify + fixture).
- The example above (8.1) **must validate** against the published schema in CI (see [09-mvp-acceptance](/09-mvp-acceptance.md) §7 topic checklist).