# 02 — Data Model

## 1. Design principles

1. **Tenant-aware from row 1.** Every business row carries `workspace_id` and every access check resolves `user → workspace membership → project → capsule permission` (never trust client-supplied IDs).
2. **Capsule content is relational, not a JSON blob.** Sections are rows; messages are rows; attachments are join tables. Only normalized display objects are materialized as JSON (see [03-capsule-schema](/03-capsule-schema.md)).
3. **Versions are immutable snapshots** — the version row stores a `content_json` snapshot (the full structured context of that point in time). The *current* sections live in live tables for edit/fast-read; `capsule_versions.content_json` is the source of truth for history/diff/rollback.
4. **Security envelope at rest**: columns that hold conversation content are encrypted in the app layer (AES-256-GCM) before persistence (default "Trusted Custodian" key; Enterprise opt-in E2EE keeps those columns as ciphertext with client-held keys — see [08-security-model](/08-security-model.md)).
5. **pgvector for retrieval** + PostgreSQL FTS for keyword. `embedding_chunks` stores encrypted chunk plaintext + vector + semantic summary (non-verbatim). Hosted on **Neon free** Postgres 16 (pgvector supported, scale-to-zero after 5 min idle — see [11-deployment](/11-deployment.md) §1).
6. **Retention**: soft-delete everywhere; purge worker enforces 30-day permanent deletion; usage logs 90 days.

## 2. ERD (Mermaid)

```mermaid
erDiagram
    USERS {
        uuid id PK
        text email UK
        text password_hash
        text full_name
        text google_sub
        text avatar_url
        text plan "free|pro|team" UK
        timestamptz trial_ends_at
        boolean e2ee_enabled
        jsonb prefs
        timestamptz created_at
        timestamptz deleted_at
    }
    WORKSPACES {
        uuid id PK
        text name
        text slug UK
        uuid owner_id FK
        timestamptz created_at
    }
    WORKSPACE_MEMBERS {
        uuid workspace_id FK
        uuid user_id FK
        text role "owner|admin|editor|contributor|viewer"
        timestamptz joined_at
    }
    TEAMS {
        uuid id PK
        uuid workspace_id FK
        text name
        text folder "engineering|product|marketing..."
        text golden_prompt
        timestamptz created_at
    }
    TEAM_MEMBERS {
        uuid team_id FK
        uuid user_id FK
        text role "admin|contributor|viewer"
    }
    PROJECTS {
        uuid id PK
        uuid workspace_id FK
        uuid team_id FK "nullable"
        text name
        text external_ref "gpt/claude project id"
        timestamptz created_at
    }
    CAPSULES {
        uuid id PK
        uuid workspace_id FK
        uuid team_id FK "nullable"
        uuid project_id FK "nullable"
        uuid owner_id FK
        text name
        text description
        text status "active|archived|deleted"
        uuid current_version_id FK "nullable"
        text source_platform
        text source_project_ref
        int version_count
        text primary_tag
        timestamptz created_at
        timestamptz updated_at
        timestamptz archived_at
        timestamptz deleted_at
    }
    CAPSULE_TAGS {
        uuid capsule_id FK
        uuid tag_id FK
    }
    TAGS {
        uuid id PK
        uuid workspace_id FK
        text name
        text color
    }
    FOLDERS {
        uuid id PK
        uuid workspace_id FK
        text name
        uuid parent_id FK "nullable"
    }
    CAPSULE_FOLDERS {
        uuid capsule_id FK
        uuid folder_id FK
    }
    CAPSULE_VERSIONS {
        uuid id PK
        uuid capsule_id FK
        int version_number
        uuid parent_version_id FK "nullable"
        uuid branch_id FK "nullable"
        uuid author_id FK
        text change_summary
        jsonb content_json "snapshot"
        text content_hash
        boolean is_current
        int token_estimate
        timestamptz created_at
    }
    CAPSULE_SECTIONS {
        uuid id PK
        uuid capsule_id FK
        uuid version_id FK "nullable"
        text section "objective|background|requirements|decisions|constraints|assumptions|open_questions"
        jsonb payload
        int sort
        timestamptz updated_at
    }
    CAPSULE_MESSAGES {
        uuid id PK
        uuid capsule_id FK
        uuid version_id FK "nullable"
        text role "user|assistant|system"
        text content
        text source_tool
        int token_estimate
        timestamptz ts
    }
    ATTACHMENTS {
        uuid id PK
        uuid workspace_id FK
        uuid uploader_id FK
        text storage_key "encrypted blob ref"
        text mime_type
        bigint byte_size
        text content_hash
        text meta_json "extracted text/pdf intercept"
        timestamptz created_at
        timestamptz deleted_at
    }
    CAPSULE_ATTACHMENTS {
        uuid capsule_id FK
        uuid attachment_id FK
        uuid version_id FK "nullable"
        text role "source|generated|manual"
    }
    EMBEDDING_CHUNKS {
        uuid id PK
        uuid version_id FK
        uuid capsule_id FK
        text section_path
        text ciphertext "encrypted chunk"
        vector vector "pgvector 768"
        text summary "non-verbatim semantic summary"
        uuid embedding_model_id FK
        timestamptz created_at
    }
    CAPTURE_SESSIONS {
        uuid id PK
        uuid user_id FK
        uuid capsule_id FK "nullable"
        text status "pending|scanning|extracting|summarizing|saving|done|error"
        int progress_pct
        text source_platform
        text error_code "nullable"
        jsonb meta
        timestamptz created_at
        timestamptz updated_at
    }
    INJECTIONS {
        uuid id PK
        uuid user_id FK
        uuid capsule_id FK
        uuid version_id FK
        text target "chatgpt|claude|gemini|gmail|ide|mcp"
        text mode "full|smart|summary|custom"
        text fingerprint UK "sha256"
        int tokens
        boolean stealth
        timestamptz created_at
    }
    API_TOKENS {
        uuid id PK
        uuid user_id FK
        uuid workspace_id FK
        text token_hash "sha256 of cht_..."
        text name
        jsonb scopes "read|write"
        int token_limit "tier"
        timestamptz last_used_at
        timestamptz created_at
        timestamptz expires_at "nullable"
        timestamptz revoked_at
    }
    SHARES {
        uuid id PK
        uuid capsule_id FK
        uuid by_user_id FK
        text token UK "shr_..."
        text access "read_only"
        boolean allow_expiration
        timestamptz expires_at
        timestamptz created_at
    }
    AUDIT_LOGS {
        uuid id PK
        uuid workspace_id FK
        uuid actor_id FK
        text action
        text resource_type
        uuid resource_id
        jsonb meta
        text ip "masked"
        timestamptz ts
    }
    USAGE_EVENTS {
        uuid id PK
        uuid workspace_id FK
        uuid user_id FK
        text metric "capture|injection|smart_extract"
        jsonb meta
        timestamptz ts
    }
    USERS ||--o{ WORKSPACES : "owns"
    WORKSPACES ||--o{ WORKSPACE_MEMBERS : "has"
    USERS ||--o{ WORKSPACE_MEMBERS : ""
    WORKSPACES ||--o{ TEAMS : "has"
    TEAMS ||--o{ TEAM_MEMBERS : "has"
    USERS ||--o{ TEAM_MEMBERS : ""
    WORKSPACES ||--o{ PROJECTS : "has"
    TEAMS ||--o{ PROJECTS : ""
    WORKSPACES ||--o{ CAPSULES : "contains"
    CAPSULES ||--o{ CAPSULE_VERSIONS : "has"
    CAPSULES ||--o{ CAPSULE_VERSIONS : "history"
    CAPSULES ||--o{ CAPSULE_SECTIONS : ""
    CAPSULES ||--o{ CAPSULE_MESSAGES : ""
    CAPSULES ||--o{ CAPSULE_ATTACHMENTS : ""
    CAPSULES ||--o{ CAPSULE_TAGS : ""
    TAGS ||--o{ CAPSULE_TAGS : ""
    CAPSULES ||--o{ CAPSULE_FOLDERS : ""
    FOLDERS ||--o{ CAPSULE_FOLDERS : ""
    ATTACHMENTS ||--o{ CAPSULE_ATTACHMENTS : ""
    CAPSULE_VERSIONS ||--o{ EMBEDDING_CHUNKS : ""
    CAPTURE_SESSIONS }o--|| CAPSULES : "produces"
    INJECTIONS }o--|| CAPSULES : ""
    USERS ||--o{ API_TOKENS : ""
    CAPSULES ||--o{ SHARES : ""
    USERS ||--o{ CAPTURE_SESSIONS : ""
    USERS ||--o{ INJECTIONS : ""
```

## 3. Table-by-table contract (MVP DDL)

Canonical DDL lives in `infrastructure/db/migrations/` (node-pg-migrate). Type notes use PostgreSQL 16. All tables carry `workspace_id` where tenant scope applies.

### 3.1 users
| column | type | notes |
|---|---|---|
| id | `uuid pk` | `usr_` ULID-derived at app layer |
| email | `citext uk` | lowercased |
| password_hash | `text null` | Argon2id (`$argon2id$…`) when email login; null for Google-only |
| full_name | `text` | |
| google_sub | `text null uk` | Google OAuth subject |
| avatar_url | `text null` | |
| plan | `text` | `free` (DEFAULT) / `pro` / `team` |
| trial_ends_at | `timestamptz null` | 14-day Pro trial |
| e2ee_enabled | `boolean default false` | Enterprise feature flag |
| prefs | `jsonb` | `{ dynamicContext: bool, stealthInjection: bool }` |
| created_at / deleted_at | timestamps | soft delete |

### 3.2 workspaces · workspace_members
- `workspaces`: `id`, `name`, `slug uk`, `owner_id → users`.
- `workspace_members`: PK `(workspace_id, user_id)`, `role in (owner,admin,editor,contributor,viewer)`, `joined_at`.

### 3.3 teams · team_members
- `teams`: `id`, `workspace_id`, `name`, `folder` (naming convention: Engineering/Product/Marketing), `golden_prompt` (nullable master context markdown), `created_at`.
- `team_members`: PK `(team_id, user_id)`, `role in (admin, contributor, viewer)`.

### 3.4 projects
- `projects`: `id`, `workspace_id`, `team_id null`, `name`, `external_ref` (JSON: `{ "kind": "gpt_project"|"claude_project", "id": "…" }`), `created_at`.
- Links capture parity with GPT/Claude Projects so capsules aggregate per project.

### 3.5 capsules
| column | type | notes |
|---|---|---|
| id | uuid pk | `cap_` |
| workspace_id | uuid fk | tenant |
| team_id / project_id | uuid fk null | org |
| owner_id | uuid fk | |
| name / description | text | |
| status | text | `active` / `archived` / `deleted` |
| current_version_id | uuid fk null | set by version create |
| source_platform | text | `chatgpt` / `claude` / `gemini` / `gmail` / `terminal` / `web` / `manual` |
| source_project_ref | text null | external chat/project ref for re-harvest |
| version_count | int | denormalized counter |
| primary_tag | text null | denormalized from tags for search/badges |
| created_at / updated_at / archived_at / deleted_at | timestamps | |

Indexes: `(workspace_id, status, updated_at desc)`, `(team_id)`, `(project_id)`, `gin(primary_tag)`.

### 3.6 capsule_versions
| column | type | notes |
|---|---|---|
| id | uuid pk | `ver_` |
| capsule_id | uuid fk | |
| version_number | int | 1-based, per-capsule unique |
| parent_version_id | uuid fk null | lineage (rollback keeps ancestor chain) |
| branch_id | uuid fk null | branching (V2 exposed; column reserved MVP) |
| author_id | uuid fk | |
| change_summary | text | human/AI one-liner of what changed |
| content_json | jsonb | **full snapshot** of structured context for this version |
| content_hash | text | sha256 of canonical JSON (dedupe deterministic saves) |
| is_current | boolean | exactly one true per capsule |
| token_estimate | int | content token budget (footer display) |
| created_at | timestamptz | |

Unique `(capsule_id, version_number)`; index `(capsule_id, created_at)`.

### 3.7 capsule_sections
Live editable sections mirror of the current version.
- `id`, `capsule_id`, `version_id null`, `section` (`objective|background|requirements|decisions|constraints|assumptions|open_questions`), `payload jsonb`, `sort int`, `updated_at`.
- `requirements`/`decisions`/… are `jsonb` arrays of `{id, text, status?}` — still row-addressable via the version snapshot diff.

### 3.8 capsule_messages
- `id`, `capsule_id`, `version_id null`, `role`, `content` (encrypted at rest by column), `source_tool` (e.g., `chatgpt.web`), `token_estimate`, `ts`.
- Harvest source: one row per message; dedupe key on `(capsule_id, source_tool, ts)`.

### 3.9 attachments · capsule_attachments
- `attachments`: `id att_…`, `workspace_id`, `uploader_id`, `storage_key` (opaque ref into StorageProvider, encrypted value), `mime_type`, `byte_size`, `content_hash`, `meta_json` (extracted text/PDF intercept result, status: `pending|parsed|failed`), soft-delete.
- `capsule_attachments`: PK `(capsule_id, attachment_id, version_id)`, `role` (`source|generated|manual`).
- Read URLs: short-lived presigned (see [08-security-model](/08-security-model.md)).

### 3.10 embedding_chunks (CapsuleIndex base)
- `id`, `version_id`, `capsule_id`, `section_path` (e.g., `requirements.3`), `ciphertext` (encrypted chunk), `vector vector(768)`, `summary` (non-verbatim), `model_id`, `created_at`.
- Index: pgvector HNSW (`vector_cosine_ops`); FTS `to_tsvector('english', summary)`.

### 3.11 capture_sessions (capture progress pipeline)
- `id csv_…`, `user_id`, `capsule_id null`, `status` in `pending|scanning|extracting|summarizing|saving|done|error`, `progress_pct int`, `source_platform`, `error_code null`, `meta jsonb`, timestamps.
- Clients poll `GET /v1/capture/:id` (poll backoff 500ms→2s); SSE is a V2 nicety.

### 3.12 injections (dedupe + usage ledger)
- `id inje_…`, `user_id`, `capsule_id`, `version_id`, `target`, `mode`, `fingerprint uk` (sha256 of `version_hash|target|composer_session_id`), `tokens int`, `stealth bool`, `created_at`.
- The `fingerprint` unique constraint is the **duplicate-injection guard** (see [05-extension](/05-extension.md) §7).

### 3.13 api_tokens
- `id`, `user_id`, `workspace_id`, `token_hash` (sha256 of `cht_…`), `name`, `scopes jsonb` (`["capsules:read","capsules:write"]`), `token_limit int` (tier), `last_used_at`, `created_at`, `expires_at null`, `revoked_at null`.
- Only the hash is stored; prefix `cht_` survives for identification.

### 3.14 shares
- `id shr_…`, `capsule_id`, `by_user_id`, `token uk`, `access read_only`, `allow_expiration bool`, `expires_at null`, `created_at`.

### 3.15 tags · folders · capsule_tags · capsule_folders
- Tags: `id`, `workspace_id`, `name`, `color`. Unique `(workspace_id, name)`.
- Folders: `id`, `workspace_id`, `name`, `parent_id null` (2-level MVP).

### 3.16 audit_logs
- `id`, `workspace_id`, `actor_id`, `action` (`capsule.created`, `version.rolled_back`, `share.created`, `token.revoked`, `team.member_added`, `e2ee.enabled`…), `resource_type`, `resource_id`, `meta jsonb`, `ip` (masked last octet), `ts`.
- Retention 90 days (see [08-security-model](/08-security-model.md)).

### 3.17 usage_events + plan ledger (billing)
- `usage_events`: `id`, `workspace_id`, `user_id`, `metric` (`capture`, `injection`, `smart_extract`, `mcp_call`), `meta`, `ts`.
- Nightly rollup → `workspace_usage_daily` for tier meters and Stripe usage records.
- Plan entitlement is gate-checked in middleware from `users.plan` + `trial_ends_at` (fast path, Redis cached).

## 4. Multi-tenancy enforcement (authorization order)

```
User
 ↓ workspace_members (workspace_id from JWT claim, NEVER from request body)
 ↓ team_members / project scoping (optional)
 ↓ capsule visibility: owner | team share | workspace share | shared link token
 ↓ resource
```
SQL access pattern — every capsule query joins membership:
```sql
WHERE c.workspace_id = $ws
  AND ( c.owner_id = $uid
     OR c.team_id IN (SELECT team_id FROM team_members WHERE user_id = $uid)
     OR c.status = 'active' )
```

## 5. Retention & purge
- Soft delete → status `deleted`, `deleted_at` set; moved off active lists immediately.
- Purge worker (nightly): hard-deletes rows + storage blobs + vector chunks where `deleted_at < now() - 30 days`.
- Usage/audit rows older than 90 days are dropped.
- Account deletion: same 30-day purge for all owned rows; tokens revoked immediately.

## 6. Migrations
- `node-pg-migrate`, numbered files in `infrastructure/db/migrations`.
- Migration = additive DDL only; destructive changes land as new migrations post-deploy.
- `npm run migrate:down` prohibited in prod; rollback is a corrective forward migration.

## 7. Storage abstraction (per D-002)
```ts
interface StorageProvider {
  put(key: string, body: Buffer|Stream): Promise<void>;
  getSignedUrl(key: string, action: 'read'|'write', ttlSec: number): Promise<string>;
  delete(key: string): Promise<void>;
}
```
- MVP (free tier): `LocalDiskProvider` mounted on Railway Free `/data/uploads` volume (**0.5 GB**, matches the free plan; see [11-deployment](/11-deployment.md) §1).
- Growth: `S3Provider` (R2/S3) via env (`S3_ENDPOINT`, `S3_BUCKET`, keys); the swap is env-only, no code change.
- Keys: `attachments/{workspace_id}/{att_ulid}/{filename}`; values encrypted before write per [08-security-model](/08-security-model.md) §8.