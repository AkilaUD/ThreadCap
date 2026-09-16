# 04 — API Contracts (REST `/v1`)

Machine-readable: **[openapi.yaml](/openapi.yaml)** (OpenAPI 3.1). This page is the normative human reference; runtimes must match the YAML. Base path `https://api.threadcap.app/v1` (development: `http://localhost:3000/v1`).

Conventions: identifiers/timestamps/pagination/errors — see [00-index](/00-index.md) §3. Auth per [00-index](/00-index.md) §3.4. Rate limits per §12.

---

## 1. Auth

### POST /auth/register
Creates an account (email+password; Google path via `/auth/google`).
```jsonc
// Request
{ "email": "dev@acme.dev", "password": "S3cureP@ss!", "fullName": "Alex Dev" }
// 201
{
  "user": { "id": "usr_01HZXV1PY2T8KDQ6RW8ZQ3M4X5", "email": "dev@acme.dev", "fullName": "Alex Dev", "plan": "free",
            "trial": { "endsAt": "2026-09-30T00:00:00.000Z" } },
  "accessToken": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.…",
  "refreshToken": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.…"
}
// 422 VALIDATION_ERROR
{
  "requestId": "req_01HZXW2M4N5P6Q7R8S9T0U1V2W3",
  "error": { "code": "VALIDATION_ERROR", "message": "Password must be at least 12 characters.",
             "details": { "fields": ["password"] } }
}
```
Errors: `422 VALIDATION_ERROR` (password ≥ 12 chars, email format), `409 EMAIL_IN_USE`.

### POST /auth/login
```jsonc
// Request
{ "email": "dev@acme.dev", "password": "S3cureP@ss!" }
// 200
{
  "user": { "id": "usr_01HZXV1PY2T8KDQ6RW8ZQ3M4X5", "email": "dev@acme.dev", "fullName": "Alex Dev",
            "plan": "pro", "trial": { "endsAt": "2026-09-30T00:00:00.000Z" },
            "prefs": { "dynamicContext": true, "stealthInjection": true } },
  "accessToken": "eyJ….", "refreshToken": "eyJ…."
}
// 401
{ "requestId": "req_01HZXW2M4N5P6Q7R8S9T0U1V2W3",
  "error": { "code": "INVALID_CREDENTIALS", "message": "Email or password is incorrect.", "details": null } }
```
Errors: `401 INVALID_CREDENTIALS`, `429 RATE_LIMITED` (5/min per email/IP).

### POST /auth/google
```jsonc
// Request
{ "credential": "<google id_token JWT>", "fullName": "Alex Dev" }
// 200 — same shape as login; creates account if new google_sub
{ "user": { "id": "usr_01HZXV1PY2T8KDQ6RW8ZQ3M4X5", "email": "dev@acme.dev", "fullName": "Alex Dev",
            "plan": "free", "trial": { "endsAt": "2026-09-30T00:00:00.000Z" } },
  "accessToken": "eyJ….", "refreshToken": "eyJ…." }
```

### POST /auth/refresh
Auth: `Authorization: Bearer <refreshToken>`.
```jsonc
// Request (empty body)
{}
// 200 (rotation — old refresh token invalidated)
{ "accessToken": "eyJ….", "refreshToken": "eyJ…." }
```
Errors: `401 INVALID_REFRESH_TOKEN`, `403 REFRESH_TOKEN_REVOKED`.

### POST /auth/logout
Auth: access token.
```jsonc
// Request (empty body) → 204 No Content
```

### GET /auth/me
Auth: access token.
```jsonc
// 200
{ "user": { "id": "usr_01HZXV1PY2T8KDQ6RW8ZQ3M4X5", "email": "dev@acme.dev", "fullName": "Alex Dev",
            "avatarUrl": "https://…", "plan": "pro",
            "trial": { "endsAt": "2026-09-30T00:00:00.000Z" },
            "prefs": { "dynamicContext": true, "stealthInjection": false } } }
```

### POST /auth/forgot-password · POST /auth/reset-password
```jsonc
// POST /auth/forgot-password
{ "email": "dev@acme.dev" } → 202 Accepted        // always 202 (no account enumeration)
// POST /auth/reset-password
{ "token": "rst_01HZX…", "password": "NewP@ssw0rd!" } → 204
```
Token single-use, 30 min TTL; errors `400 TOKEN_EXPIRED` / `400 TOKEN_INVALID`.

---

## 2. Capsules

### GET /capsules
List with filters. Auth required.
```
?q=loan                keyword (FTS over name/description/summary/primary_tag)
&tag=ecoru             exact tag
&team=tm_…             team scope
&project=prj_…
&status=active|archived|deleted      default active
&mode=smart|raw        capture mode filter
&limit=20&cursor=…
```
`200`:
```jsonc
{
  "items": [
    {
      "id": "cap_01HZXV1PY2T8KDQ6RW8ZQ3M4X5", "workspaceId": "ws_01HZX…",
      "teamId": null, "projectId": "prj_01HZX…",
      "name": "Loan Module", "description": "Loan approval flow requirements",
      "status": "active", "source": { "platform": "chatgpt", "projectRef": "f3a9b2…", "capturedAt": "2026-09-15T14:22:00.000Z" },
      "tags": ["ecoru", "finance"], "primaryTag": "ecoru",
      "versionCount": 7, "currentVersionId": "ver_01HZX…",
      "createdAt": "2026-09-10T09:00:00.000Z", "updatedAt": "2026-09-15T14:22:00.000Z"
    }
  ],
  "meta": { "nextCursor": "ver_01HZXV1PY2T8KDQ6RW8ZQ3M4X5", "total": 12 }
}
```

### POST /capsules
Create a capsule with version 1.
```jsonc
// Request (body = Capsule wrapper needs; content = version content)
{
  "name": "Loan Module",
  "description": "Loan approval flow requirements, captured from ChatGPT",
  "teamId": null, "projectId": "prj_01HZX…",
  "tags": ["ecoru"],
  "source": { "platform": "chatgpt", "projectRef": "f3a9b2c1…", "capturedAt": "2026-09-15T14:22:00.000Z" },
  "content": {
    "objective": "Implement loan approval flow with dual validation",
    "background": "Legacy .NET MVC; migrating to React + .NET 10",
    "requirements": [
      { "id": "req_01HZX…", "text": "Loan minimum amount must be 10,000.", "status": "open" },
      { "id": "req_01HZX…", "text": "Validation must run before submission.", "status": "open" }
    ],
    "constraints": [ { "id": "con_01HZX…", "text": "Response < 300 ms p95.", "status": "accepted" } ],
    "decisions": [ { "id": "dec_01HZX…", "text": "React + TypeScript frontend.", "status": "accepted" } ],
    "assumptions": [], "openQuestions": [],
    "conversation": [ { "role": "user", "content": "What is the loan minimum?", "ts": "2026-09-15T14:20:00.000Z" } ],
    "attachments": [], "links": [],
    "summary": "Loan approval flow with minimum 10,000 and pre-submission validation."
  }
}
// 201 → { capsule: {…wrapper…, complete with currentVersionId}, version: {…} }
{
  "capsule": { "id": "cap_01HZXV1PY2T8KDQ6RW8ZQ3M4X5", "name": "Loan Module", "versionCount": 1,
               "currentVersionId": "ver_01HZX…", "status": "active", "…": "…" },
  "version": {
    "id": "ver_01HZXV1PY2T8KDQ6RW8ZQ3M4X5", "capsuleId": "cap_01HZX…", "versionNumber": 1,
    "parentVersionId": null, "branchId": null, "authorId": "usr_01HZX…",
    "changeSummary": "Created from ChatGPT chat", "contentHash": "sha256:…", "tokenEstimate": 1842,
    "isCurrent": true, "createdAt": "2026-09-15T14:22:05.000Z"
  }
}
// 409 TOO_MANY_ACTIVE
{ "requestId": "req_…", "error": { "code": "TOO_MANY_ACTIVE",
  "message": "Free plan allows 25 active capsules. Archive one to create another.", "details": null } }
```
Errors: `409 TOO_MANY_ACTIVE` (free tier 25), `422 VALIDATION_ERROR`.

### GET /capsules/:id · PUT /capsules/:id · DELETE /capsules/:id
- `GET` → wrapper + `latestVersion` content (full) + `sections` (live) + `attachments`, `messages` counts. `404 CAPSULE_NOT_FOUND`.
```jsonc
// GET /capsules/cap_01HZX… → 200
{
  "id": "cap_01HZX…", "name": "Loan Module", "status": "active", "versionCount": 7,
  "currentVersionId": "ver_01HZX…",
  "latestVersion": { "id": "ver_01HZX…", "versionNumber": 7, "changeSummary": "Extended from ChatGPT chat",
                     "contentHash": "sha256:…", "tokenEstimate": 4210, "isCurrent": true,
                     "content": { "objective": "…", "requirements": [ "…" ], "…": "…" },
                     "createdAt": "2026-09-15T14:22:05.000Z" },
  "audit": { "attachments": 4, "messages": 128, "totalTokens": 18420 }
}
// 404
{ "requestId": "req_…", "error": { "code": "CAPSULE_NOT_FOUND",
  "message": "Capsule cap_01HZX… does not exist or you do not have access.", "details": null } }
```
- `PUT` updates mutable metadata: `name`, `description`, `teamId`, `projectId`, `tags`, `status` (only `archived ⇄ active`). Returns 200 wrapper. Guards: free tier may set `status: archived` freely; un-archiving below 25 cap always allowed.
```jsonc
// PUT /capsules/cap_01HZX…
{ "name": "Loan Module (revised)", "tags": ["ecoru", "finance", "verification"] }
// 200 → updated wrapper
{ "id": "cap_01HZX…", "name": "Loan Module (revised)", "tags": ["ecoru", "finance", "verification"], "…": "…" }
```
- `DELETE` → soft delete: `status: deleted`, `deleted_at` set. Returns `204`. (Hard purge after 30 days by worker.)

### POST /capsules/:id/archive · POST /capsules/:id/restore
```jsonc
// POST /capsules/cap_01HZX…/archive → 200
{ "status": "archived" }
// POST /capsules/cap_01HZX…/restore → 200
{ "status": "active" }
// 409 ARCHIVE_FORBIDDEN if archived already / restore blocked by cap
```

### POST /capsules/:id/versions
Create a **new version** of the capsule.
```jsonc
// Request
{
  "changeSummary": "Added authorization requirement",
  "content": { /* full CapsuleContent — server diffs vs current */ },
  "force": false
}
// 201 → { version: {…}, capsule: {…} }   409 CAPSULE_UNCHANGED if hash equals current & !force
{
  "version": { "id": "ver_01HZX…", "capsuleId": "cap_01HZX…", "versionNumber": 8,
               "parentVersionId": "ver_01HZX…", "changeSummary": "Added authorization requirement",
               "contentHash": "sha256:…", "tokenEstimate": 4350, "isCurrent": true,
               "createdAt": "2026-09-16T10:05:00.000Z" },
  "capsule": { "id": "cap_01HZX…", "versionCount": 8, "currentVersionId": "ver_01HZX…" }
}
// 409 CAPSULE_UNCHANGED (identical content hash & !force)
{ "requestId": "req_…", "error": { "code": "CAPSULE_UNCHANGED",
  "message": "This version matches the current content — nothing changed. Use force:true only if intended.", "details": null } }
```
Inline edits use the same endpoint; the UI always sends full `content`.

### GET /capsules/:id/versions
```jsonc
// 200
{
  "items": [
    { "versionNumber": 8, "id": "ver_01HZX…", "authorId": "usr_01HZX…",
      "changeSummary": "Added authorization requirement", "createdAt": "2026-09-16T10:05:00.000Z",
      "tokenEstimate": 4350, "contentHash": "sha256:…", "isCurrent": true },
    { "versionNumber": 7, "id": "ver_01HZX…", "authorId": "usr_01HZX…",
      "changeSummary": "Extended from ChatGPT chat", "createdAt": "2026-09-15T14:22:05.000Z",
      "tokenEstimate": 4210, "contentHash": "sha256:…", "isCurrent": false }
  ],
  "meta": { "nextCursor": null, "total": 8 }
}
```
(no full content — use GET /versions/:id).

### GET /versions/:versionId
```jsonc
// 200 — full version incl. content
{
  "id": "ver_01HZX…", "capsuleId": "cap_01HZX…", "versionNumber": 8,
  "parentVersionId": "ver_01HZX…", "branchId": null, "authorId": "usr_01HZX…",
  "changeSummary": "Added authorization requirement",
  "content": { "objective": "…", "requirements": [ { "id": "req_…", "text": "…", "status": "open" } ], "…": "…" },
  "contentHash": "sha256:…", "tokenEstimate": 4350, "isCurrent": true,
  "createdAt": "2026-09-16T10:05:00.000Z"
}
```
`404 VERSION_NOT_FOUND`.

### POST /versions/:versionId/rollback
Creates a new version cloning `:versionId` content onto the capsule's current version (vN+1).
```jsonc
// POST /versions/ver_01HZX…/rollback
// (empty request body; server sets changeSummary = "Rollback to v6")
// 201
{ "version": { "id": "ver_01HZX…", "versionNumber": 9, "parentVersionId": "ver_01HZX…",
               "changeSummary": "Rollback to v6", "contentHash": "sha256:…",
               "createdAt": "2026-09-16T10:30:00.000Z" } }
```

### PUT /versions/:versionId
Alias of `POST /capsules/:id/versions` when `:versionId` is current — **inline edit** of the current version (always creates vN+1, never mutates). 409 if not current: `VERSION_NOT_CURRENT`.
```jsonc
// PUT /versions/ver_01HZX…  (current version)
{ "content": { "objective": "…", "…": "…" }, "changeSummary": "Edited requirements 2, added decision 3" }
// 201 → { version: { versionNumber: 9, isCurrent: true, … } }
// 409 VERSION_NOT_CURRENT if :versionId is not current
```

### POST /capsules/:id/split  *(V2 — stub in YAML)*
`{ "messageIds": ["…"], "name": "Engineering slice", "mode": "copy|move" }` → 201 new capsule. Stub: returns `501 NOT_IMPLEMENTED`.

### POST /capsules/merge  *(V2 — stub)*
`{ "capsuleIds": ["cap_…","cap_…"], "name": "…" }` → 201. Stub: `501 NOT_IMPLEMENTED`.

---

## 3. Capture pipeline

### POST /capture
Kick off a capture. **Idempotent by fingerprint** (source ref + ts range + user).
```jsonc
// Request
{
  "platform": "chatgpt",
  "projectRef": "f3a9b2c1…",
  "mode": "smart",
  "messages": [
    { "role": "user", "content": "What is the loan minimum?", "ts": "2026-09-15T14:20:00.000Z",
      "sourceTool": null, "tokenEstimate": 12 },
    { "role": "assistant", "content": "The loan minimum is 10,000.", "ts": "2026-09-15T14:20:08.000Z", "tokenEstimate": 14 }
  ],
  "attachments": [ { "name": "loan-spec-v2.pdf", "mimeType": "application/pdf", "size": 204800 } ],
  "target": { "capsuleId": null, "action": "new", "refresh": false }
}
// 202
{ "sessionId": "csv_01HZXV1PY2T8KDQ6RW8ZQ3M4X5", "status": "pending", "progressPct": 0 }
// 422 VALIDATION_ERROR (payload > 2 MB, > 500 messages, missing platform)
{ "requestId": "req_…", "error": { "code": "VALIDATION_ERROR",
  "message": "Capture payload exceeds the 2 MB limit.", "details": { "fields": ["messages"] } } }
```
Rules: payload ≤ 2 MB, ≤ 500 messages; `smart` escalates to extraction worker; response is always `202` with a session.

### GET /capture/:sessionId
Poll capture progress (backoff 500 ms → 2 s).
```jsonc
// 200 — in progress
{ "sessionId": "csv_01HZX…", "status": "extracting", "progressPct": 62,
  "stage": "summarizing", "error": null, "result": null }
// 200 — done
{ "sessionId": "csv_01HZX…", "status": "done", "progressPct": 100, "stage": "saving", "error": null,
  "result": { "capsuleId": "cap_01HZX…", "versionId": "ver_01HZX…" } }
// 200 — error
{ "sessionId": "csv_01HZX…", "status": "error", "progressPct": 62, "stage": "extracting",
  "error": { "code": "CAPTURE_FAILED", "message": "Extraction provider timed out." }, "result": null }
```
Status machine: `pending → scanning → extracting → summarizing → saving → done | error`. Every transition updates `progressPct` monotonically.

---

## 4. Search & retrieval

### GET /search
Hybrid keyword + vector. Auth required; scope-filtered by tenant.
```
?q=loan minimum validation
&capsuleId=cap_…
&team=tm_…&project=prj_…
&kind=all|capsule|message|attachment
&limit=20&cursor=…
```
```jsonc
// 200
{
  "items": [
    { "kind": "message", "id": "msg_01HZX…", "capsuleId": "cap_01HZX…", "versionId": "ver_01HZX…",
      "snippet": "The <mark>loan minimum</mark> is <mark>10,000</mark>…", "score": 0.93,
      "href": "https://app.threadcap.app/cap_01HZX…?version=8&section=conversation#msg_01HZX…" },
    { "kind": "capsule", "id": "cap_01HZX…", "capsuleId": "cap_01HZX…", "versionId": null,
      "snippet": "Loan approval flow with <mark>minimum</mark> 10,000…", "score": 0.71,
      "href": "https://app.threadcap.app/cap_01HZX…" }
  ],
  "meta": { "nextCursor": null, "total": 2 }
}
```
MVP uses FTS + pgvector top-k fusion; ties broken by recency. (Semantic Q&A via `POST /search/qa` — V2 stub `501`.)

---

## 5. Attachments

### POST /attachments/presign
Request a write URL (extension/upload direct to storage).
```jsonc
{ "filename": "loan-spec-v2.pdf", "mimeType": "application/pdf", "size": 204800 }
// 201
{ "attachmentRef": { "id": "att_01HZXV1PY2T8KDQ6RW8ZQ3M4X5",
  "uploadUrl": "https://uploads.threadcap.app/att_01HZX…?X-Amz-Expires=1800&X-Amz-Signature=…",
  "expiresIn": 1800 } }
// 422 UNSUPPORTED_MIME (e.g. .exe) or 403 QUOTA_EXCEEDED (workspace storage cap)
{ "requestId": "req_…", "error": { "code": "QUOTA_EXCEEDED",
  "message": "Workspace storage quota exceeded (2 GB limit on Pro).", "details": { "limitBytes": 2147483648 } } }
```
Server verifies MIME allow-list, size ceilings by tier, and workspace quota; returns short-lived signed URL (30 min).

### POST /attachments
Register an uploaded object (after the client PUTs to `uploadUrl`).
```jsonc
{ "id": "att_01HZX…", "name": "loan-spec-v2.pdf", "mimeType": "application/pdf", "size": 204800,
  "contentHash": "sha256:…", "meta": { "parsed": true, "text": "Loan minimum 10,000. Validation before submission…" } }
// 201
{ "attachment": { "id": "att_01HZX…", "name": "loan-spec-v2.pdf", "mimeType": "application/pdf",
                  "size": 204800, "contentHash": "sha256:…", "parsed": true,
                  "createdAt": "2026-09-15T14:25:00.000Z" } }
```
`meta.text` (extracted text / PDF intercept) is stored **encrypted at rest**; on Free-tier skip parsing when over 10 MB.

### GET /attachments/:id
```jsonc
// 200
{ "attachment": { "id": "att_01HZX…", "name": "loan-spec-v2.pdf", "mimeType": "application/pdf",
                  "size": 204800, "parsed": true, "createdAt": "2026-09-15T14:25:00.000Z" },
  "readUrl": "https://uploads.threadcap.app/att_01HZX…?X-Amz-Expires=900&X-Amz-Signature=…",
  "capsuleIds": ["cap_01HZX…", "cap_01HZX…"] }
```
`404 ATTACHMENT_NOT_FOUND`.

### DELETE /attachments/:id
Soft-delete; unlinked from capsules → `204` (purge worker removes blob after 30 days).

---

## 6. Injections

### POST /injections/prepare
Build a deterministic injection payload **without side effects** (for preview).
```jsonc
// Request — purpose-driven brief (D-012)
{
  "capsuleId": "cap_01HZX…", "versionId": "ver_01HZX…", "mode": "custom",
  "target": "chatgpt", "composerSession": "c0a8d1f2-…",
  "purpose": "handoff", "maxTokens": 1500,
  "include": { "requirements": true, "decisions": true, "conversation": false,
               "attachments": false, "openQuestions": false },
  "attachAsFile": true
}
// 200
{
  "payload": {
    "title": "CAPSULE · Loan Module", "objective": "Implement loan approval flow with dual validation",
    "requirements": [ "Loan minimum amount must be 10,000.", "Validation must run before submission." ],
    "decisions": [ "React + TypeScript frontend." ],
    "statuses": { "req_3": "open", "req_4": "accepted" }
  },
  "format": "markdown", "tokenEstimate": 1240, "chars": 7200,
  "fingerprint": "a3f9c2b7d4e8f1a0b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4",
  "capsuleId": "cap_01HZX…", "versionId": "ver_01HZX…",
  "purpose": "handoff", "maxTokens": 1500, "budgetExceeded": false,
  "excludedSections": ["constraints", "openQuestions", "attachments"],
  "attachAsFile": { "briefMarkdown": "# Loan Module · context\n…objective-first brevity block…",
                    "fileName": "Loan-Module-v8.context.md" }
}
// 200 — BUDGET_EXCEEDED is a 200-with-cheapest-variant, not an error
{
  "payload": { "title": "CAPSULE RECAP · Loan Module", "objective": "…", "summary": "…" },
  "format": "markdown", "tokenEstimate": 752, "chars": 4100,
  "fingerprint": "…", "capsuleId": "cap_01HZX…", "versionId": "ver_01HZX…",
  "purpose": "recap", "maxTokens": 400, "budgetExceeded": true,
  "excludedSections": ["constraints", "openQuestions", "attachments", "decisions"],
  "attachAsFile": null
}
```
`fingerprint` = SHA-256 over `version.content_hash | target | composerSession`; stable within a conversation for dedupe.

### POST /injections
Record an actual injection (after the client pastes/injects). Enforces the fingerprint guard.
```jsonc
{ "capsuleId": "cap_01HZX…", "versionId": "ver_01HZX…", "target": "chatgpt",
  "composerSession": "c0a8d1f2-…", "mode": "full", "tokens": 3821, "stealth": true,
  "fingerprint": "a3f9c2b7…" }
// 201
{ "injection": { "id": "inje_01HZXV1PY2T8KDQ6RW8ZQ3M4X5", "deduped": false } }
// 409 INJECTION_DUPLICATE
{ "requestId": "req_…", "error": { "code": "INJECTION_DUPLICATE",
  "message": "This capsule was already injected into this conversation.",
  "details": { "existingInjectionId": "inje_01HZX…", "at": "2026-09-15T15:00:12.000Z" } } }
```
Client handles `409` by showing "Already injected here — reinject anyway?" (forces new `composerSession`).

---

## 7. MCP tokens (see also [06-mcp](/06-mcp.md))

```jsonc
// POST /mcp-tokens
{ "name": "cursor", "scopes": ["capsules:read"] }
// 201 — full secret shown ONCE; server stores hash only
{ "token": "cht_4f8a7b3c9d1e2f0a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8" }
// 403 TOKEN_LIMIT_REACHED (Pro 3, Team 10, Enterprise unlimited)
{ "requestId": "req_…", "error": { "code": "TOKEN_LIMIT_REACHED",
  "message": "You've reached the token limit for your plan (3/3).", "details": { "limit": 3 } } }

// GET /mcp-tokens
// 200
{ "items": [
  { "id": "cht_01HZXV1PY2T8KDQ6RW8ZQ3M4X5", "name": "cursor", "prefix": "cht_4f8a", "scopes": ["capsules:read"],
    "lastUsedAt": "2026-09-15T13:00:00.000Z", "createdAt": "2026-09-01T09:00:00.000Z", "revokedAt": null }
]}

// DELETE /mcp-tokens/cht_01HZX… → 204
```

---

## 8. Teams & members

```jsonc
// POST /teams
{ "name": "Engineering", "folder": "eng-products" }
// 201
{ "team": { "id": "tm_01HZXV1PY2T8KDQ6RW8ZQ3M4X5", "name": "Engineering", "folder": "eng-products",
            "goldenPrompt": null, "role": "owner", "memberCount": 1, "capsuleCount": 0,
            "createdAt": "2026-09-16T09:00:00.000Z" } }
// 403 PLAN_REQUIRED (create requires Team plan)
{ "requestId": "req_…", "error": { "code": "PLAN_REQUIRED",
  "message": "Creating teams requires the Team plan ($10/user/mo).", "details": null } }

// GET /teams
// 200
{ "items": [
  { "id": "tm_01HZX…", "name": "Engineering", "folder": "eng-products", "goldenPrompt": "…",
    "role": "owner", "memberCount": 8, "capsuleCount": 42, "createdAt": "2026-09-16T09:00:00.000Z" }
]}

// POST /teams/tm_01HZX…/members   (admin only)
{ "email": "priya@acme.dev", "role": "contributor" }
// 201 — response includes the pending invite state
{ "invite": { "id": "inv_01HZX…", "email": "priya@acme.dev", "role": "contributor",
              "status": "pending", "expiresAt": "2026-09-23T09:00:00.000Z" } }

// PUT /teams/tm_01HZX…/members/usr_01HZX…   (role change; admin only)
{ "role": "admin" }
// 200 { "role": "admin" }

// DELETE /teams/tm_01HZX…/members/usr_01HZX…  → 204   (leave/remove; admin or self)

// PUT /teams/tm_01HZX…
{ "name": "Engineering", "goldenPrompt": "Team briefing for all engineering work on Ecoru…" }
// 200 → updated team object
```

---

## 9. Shares (read-only links)

```jsonc
// POST /capsules/cap_01HZX…/shares
{ "expiresAt": "2026-10-15T00:00:00.000Z" }
// 201
{ "token": "shr_01HZXV1PY2T8KDQ6RW8ZQ3M4X5",
  "url": "https://app.threadcap.app/s/shr_01HZXV1PY2T8KDQ6RW8ZQ3M4X5" }

// GET /shares/shr_01HZX…  (public, NO auth)
// 200 — sensitive fields stripped (conversation omitted unless includeConversation=1&ephemeral=1)
{ "capsule": { "id": "cap_01HZX…", "name": "Loan Module", "status": "active",
               "latestVersion": { "versionNumber": 8, "content": { "objective": "…", "requirements": "…" }, "…": "…" }, "…": "…" } }
// 404 SHARE_NOT_FOUND or SHARE_EXPIRED
{ "requestId": "req_…", "error": { "code": "SHARE_EXPIRED",
  "message": "This share link has expired.", "details": { "expiredAt": "2026-10-15T00:00:00.000Z" } } }

// DELETE /shares/shr_01HZX… → 204
```

## 10. Import from shared link

```jsonc
// POST /capsules/import-share
{ "url": "https://chatgpt.com/share/67f3a9b2c1d4e5f6a7b8c9d0f1e2a3b4" }
// 202 (reuses capture pipeline)
{ "sessionId": "csv_01HZX…", "status": "pending", "progressPct": 0 }
// 422 UNSUPPORTED_SOURCE
{ "requestId": "req_…", "error": { "code": "UNSUPPORTED_SOURCE",
  "message": "This share URL isn't a supported source platform.", "details": null } }
```
Fetch + normalize source thread into a raw capture (cap ≤ 2 MB).

---

## 11. Webhooks & events (V2 stub)
- `POST /webhooks` create; `POST /webhooks/:id/test`; event types: `capsule.created`, `capsule.version_created`, `injection.created`. Stub `501` in MVP.

---

## 12. Rate limits (Redis sliding window)

| Scope | Limit |
|---|---|
| Auth endpoints | 5/min per email/IP |
| Capture submit | 20/min per user |
| Search / list | 60/min per user |
| Injection prepare | 120/min per user |
| Public share reads | 300/min per IP |
| MCP tool calls | 300/min per token |

429 payload: `{ "requestId", "error": { "code": "RATE_LIMITED", "message": "Slow down.", "details": { "retryAfterSec": 12 } } }`, header `Retry-After`, `X-RateLimit-*` on all responses.

---

## 13. Response-style rules
- 2xx bodies are plain JSON; lists wrap in `{ items, meta }`.
- Server time is authoritative (`Date` header + `X-Request-Id` echoing).
- No cookies: refresh token is a bearer JWT returned in body (mobile/extension friendly). HttpOnly cookies may ship later for web-only sessions — out of MVP.
- Idempotency: `POST /capture`, `POST /attachments/presign`, `POST /injections` accept `Idempotency-Key` header (uuid v4); duplicate within 24 h returns the first result with `Idempotent-Replay: true`.