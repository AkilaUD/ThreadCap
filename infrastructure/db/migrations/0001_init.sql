-- Up Migration

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
  id TEXT PRIMARY KEY,                  -- usr_<ulid>
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT,
  google_sub TEXT UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,                  -- ws_<ulid>
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  plan TEXT NOT NULL DEFAULT 'free',    -- free|pro|team|enterprise
  trial_ends_at TIMESTAMPTZ,
  e2ee_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member',  -- owner|admin|member|viewer
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,                  -- prj_<ulid>
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE capsules (
  id TEXT PRIMARY KEY,                  -- cap_<ulid>
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  project_id TEXT REFERENCES projects(id),
  user_id TEXT NOT NULL REFERENCES users(id),   -- creator
  title TEXT NOT NULL DEFAULT 'Untitled',
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',        -- draft|active|archived
  tags TEXT[] NOT NULL DEFAULT '{}',
  capture_mode TEXT NOT NULL DEFAULT 'api',     -- raw|smart|paste|sdk|file|api
  fingerprint TEXT,                             -- duplicate-injection guard
  metadata jsonb NOT NULL DEFAULT '{}',
  current_version_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_capsules_workspace ON capsules (workspace_id, updated_at DESC);
CREATE INDEX idx_capsules_status ON capsules (status);

CREATE TABLE capsule_versions (
  id TEXT PRIMARY KEY,                  -- ver_<ulid>
  capsule_id TEXT NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  parent_id TEXT REFERENCES capsule_versions(id),
  content_hash TEXT NOT NULL,
  change_summary TEXT NOT NULL DEFAULT '',
  content_json jsonb NOT NULL,          -- full snapshot (sections) at this point in time
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (capsule_id, version_number)
);

CREATE TABLE sections (
  id TEXT PRIMARY KEY,                  -- sec_<ulid>
  capsule_id TEXT NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES capsule_versions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                   -- summary|story|people|requirements|decisions|references|next
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  ordering INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sections_capsule ON sections (capsule_id, ordering);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,                  -- msg_<ulid>
  capsule_id TEXT NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  parent_id TEXT,
  seq INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_capsule ON messages (capsule_id, seq);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,                  -- att_<ulid>
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  capsule_id TEXT REFERENCES capsules(id) ON DELETE SET NULL,
  storage_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE capsule_attachments (
  capsule_id TEXT NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
  attachment_id TEXT NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  PRIMARY KEY (capsule_id, attachment_id)
);

CREATE TABLE embedding_chunks (
  id TEXT PRIMARY KEY,                  -- chk_<ulid>
  capsule_id TEXT NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES capsule_versions(id) ON DELETE CASCADE,
  section_id TEXT REFERENCES sections(id) ON DELETE CASCADE,
  chunk_plaintext TEXT NOT NULL,        -- encrypted at app layer before write
  semantic_summary TEXT NOT NULL DEFAULT '',
  embedding vector(768)                 -- pgvector (Neon)
);
CREATE INDEX idx_embedding_chunks_van ON embedding_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE injections (
  id TEXT PRIMARY KEY,                  -- inje_<ulid>
  capsule_id TEXT NOT NULL REFERENCES capsules(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  target TEXT NOT NULL,                 -- chatgpt|claude|gemini|deepseek|perplexity|gmail
  mode TEXT NOT NULL,                   -- inline|attach|paste
  fingerprint TEXT NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  budget_tokens INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'prepared',  -- prepared|injected|duplicate|failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, fingerprint)
);
CREATE INDEX idx_injections_user ON injections (user_id, created_at DESC);

CREATE TABLE share_links (
  id TEXT PRIMARY KEY,                  -- shr_<ulid>
  capsule_id TEXT NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  revoke_after_views INTEGER,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_share_links_token ON share_links (token);

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,                  -- cht_<ulid>
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id),
  user_id TEXT,
  actor TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  ip TEXT,
  meta jsonb NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_workspace ON audit_logs (workspace_id, created_at DESC);

CREATE TABLE usage_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  event_type TEXT NOT NULL,             -- capture|injection|search
  amount INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_usage_events_ws_ts ON usage_events (workspace_id, created_at);

-- Down Migration

DROP TABLE IF EXISTS usage_events, audit_logs, api_keys, share_links, injections,
  embedding_chunks, capsule_attachments, attachments, messages, sections,
  capsule_versions, capsules, projects, workspace_members, workspaces, users;
DROP EXTENSION IF EXISTS vector;
DROP TABLE IF EXISTS schema_migrations;