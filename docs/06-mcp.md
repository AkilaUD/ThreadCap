# 06 — MCP Server & Claude Code Skills

## 1. Goals

Let any MCP-capable client (Cursor, Antigravity, VS Code + Copilot, Windsurf, Claude Code) treat Capsules as **portable contracts between agents** — planning agent produces a capsule, coding agent consumes it via MCP, review agent gets the updated version. Same tools exposed to Claude Code through terminal skills (thin CLI wrappers over the same tool registry).

## 2. Transport

| Mode | Endpoint | Use |
|---|---|---|
| **Streamable HTTP** (remote, prod) | `https://api.threadcap.app/mcp/` | IDEs/agents hitting the hosted server |
| **stdio** (local dev/self-host) | `npx threadcap-mcp` | local tooling |

- Streamable HTTP implements the MCP Stdio/HTTP spec from `@modelcontextprotocol/sdk` (TypeScript). JSON-RPC 2.0 over `POST /mcp/`; `Accept: application/json, text/event-stream`.
- Auth: `X-API-Key: cht_…` header (see [04-api-contracts](/04-api-contracts.md) §7). The scope of the token is enforced server-side per tool.
- `client info` must include a clientId echoed in audit logs (`tool_used`, `clientId`, `ip`).

## 3. Token lifecycle (`cht-*`)

1. User generates from **Settings → API Tokens** (`POST /v1/mcp-tokens`).
2. Secret shown **once** (`cht_<62 chars>`); server stores only `sha256(secret)`.
3. Config snippet for clients:
```json
{
  "mcpServers": {
    "threadcap": {
      "serverUrl": "https://api.threadcap.app/mcp/",
      "headers": { "X-API-Key": "cht_xxxxxxxxxxxxxxxxxxxxxxxxxx",
                   "Content-Type": "application/json" }
    }
  }
}
```
4. Limits: Pro = 3 tokens, Team = 10, Enterprise = unlimited; scopes `capsules:read` / `capsules:write` (+ `capsules:admin` Enterprise).
5. Rotation: revoke → regenerate from UI or `DELETE /v1/mcp-tokens/:id`.
6. 401s: `{ "error": { "code": "INVALID_API_KEY" } }` → client shows "Re-run /capsule-login".

## 4. Tool inventory (MVP)

| # | Tool | Scopes | Description |
|---|---|---|---|
| 1 | `search_capsules` | read | keyword/tag/project/team search over capsule summaries + metadata |
| 2 | `get_capsule` | read | capsule wrapper + latest version (optionally a specific version) |
| 3 | `read_version` | read | full immutable version incl. structured content |
| 4 | `search_context` | read | semantic top-k chunks across a capsule/corpus (RAG select for dynamic context) |
| 5 | `create_capsule` | write | create capsule from `messages[]` (+ optional `name`/`tag`/`team`/`project`) → raw or smart |
| 6 | `create_capsule_version` | write | new version on existing capsule (change summary auto or provided) |
| 7 | `attach_file` | write | register an uploaded file ref to a capsule (MVP: accept `storageKey` from client upload) |

V2 adds: `branch_capsule`, `merge_capsules`, `split_capsule`, `share_capsule`, `rollback_version`, `get_team`.

**Keep the surface small** (D-011): 7 tools MVP. AI agents get a predictable interface; no 40-tool sprawl.

## 5. Tool schemas (JSON-RPC `tools/call`)

### search_capsules
```jsonc
// arguments
{ "summary_query": "loan validation", "tag": "ecoru", "team": "tm_…",
  "project": "prj_…", "limit": 20, "offset": 0 }
// result (tools/call → content[0].text is JSON string)
{ "results": [ { "capsule_id": "cap_…", "tag": "ecoru", "team": "tm_…",
                 "version_count": 4, "summary": "…", "updated_at": "…" } ],
  "total": 12 }
```

### create_capsule
```jsonc
// arguments
{ "name": "Auth refactor decisions", "tag": "auth", "team": "tm_…", "project": "prj_…",
  "mode": "smart", "messages": [
    { "role": "user", "content": "We need to move to JWT…" },
    { "role": "assistant", "content": "Plan: rotate refresh tokens…" } ] }
// result
{ "capsule_id": "cap_…", "version_id": "ver_…", "summary": "…", "status": "ok" }
```

All tools return `content[0].text` = JSON; errors come back as MCP `isError: true` with an object matching the error envelope `{ code, message }`.

## 6. Example agent workflow (spec'd as acceptance scenario)

```
planning agent:  /capsule-save --tag "auth-refactor" (terminal)   → cap_…
coding agent:    (Cursor, MCP) search_capsules → get_capsule id    → reads v1
                 create_capsule_version {capsule_id, content…}     → ver_2
review agent:    get_capsule id --version ver_2 → read sections    → review comments
```
A capsule ID + version acts as the shared reference point for deterministic automation.

## 7. Claude Code Skills (terminal surface)

Repo `apps/skills` (shipped to GitHub `threadcap/skills`), symlinked into `~/.claude/skills`.

| Skill | Maps to tool | Behavior |
|---|---|---|
| `/capsule-login` | auth (not MCP) | `POST /v1/auth/login` (email/password or Google token in env) → stores JWT in `~/.capsule_api_key`-adjacent session file; 401-safe |
| `/capsule-search` | `search_capsules` | prints `[id] tag — vN` + summary; flags `--tag`, `--team`, `--limit` |
| `/capsule-read` | `get_capsule` + `read_version` | `--version latest|N`; prints metadata, sections, messages (truncated), attachments |
| `/capsule-save` | `create_capsule` | builds `messages[]` from current conversation; `--tag`, `--team`, `--smart\|--raw` |
| `/capsule-version` | `create_capsule_version` + rollback (V2) | `--new-version`, `--rollback <ver>` (V2), rename/share/delete |
| `/capsule-team` | teams API | create team, add member, set golden prompt |

- Auth: skills have two paths — (1) **web JWT** (`/capsule-login`): stores a short-lived access + **OS-keychain-backed refresh token** (not shell env), rotates silently before expiry; a watchdog alarm re-prompt appears only when refresh fails or reaches 30 days — "press Enter to re-auth in browser"; 401 → inline rescue link `open https://threadcap.app/login?device=<code>`. (2) **API key mode** (`CAPSULE_API_KEY`): long-lived `cht_*` token, no browser needed, ideal for CI/headless; `/capsule-login --key` prints the generate flow.
- `setup.sh`: creates symlinks; `git pull` updates; idempotent.
- Skill markdowns validated against the same tool schemas (`packages/shared-types`), so agent behavior matches the API exactly.

## 8. Discovery & zero-friction setup (D-016)
- Logged-in users see "MCP" quickstart on dashboard + Settings → API tokens.
- Public `serverUrl`, example client config, and tools endpoint listed on docs site + `/.well-known/mcp.json` (advertises `mcpServers` for catalog rich-discovery; out of MVP if catalog unreachable).
- **One-command onboarding** (kills C-8 setup friction): `npm i -g @threadcap/cli` then `threadcap setup` — interactively (or non-interactively via `--ci`): validates Node, installs the 6 Claude skills (`setup.sh` logic), writes `~/.claude.json`/`mcpServers` config for Cursor/Copilot/Windsurf targets, performs a test `create_capsule` round-trip, and prints the blocked config snippet for copy-paste into any other MCP client. Idempotent; `threadcap setup doctor` re-verifies auth, version, and scopes.
- Runtime client-config template regenerated from the same tool schemas (single source of truth).

## 9. MVP acceptance (excerpt — full list in [09-mvp-acceptance](/09-mvp-acceptance.md) §4)
- M-1 search_capsules returns only tenant-scoped results.
- M-2 create_capsule with 25 active free caps → `403 CAPSULE_LIMIT` surfaced via isError.
- M-3 X-API-Key missing/invalid → `INVALID_API_KEY`; revoked token rejected immediately.
- M-4 500 messages in create_capsule → `422 VALIDATION_ERROR` with count in details.